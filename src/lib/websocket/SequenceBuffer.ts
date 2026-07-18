import type { ServerMessage } from "@/src/types/protocol";

/**
 * Holds server events until their predecessors have arrived.
 *
 * PING messages participate in sequence progression because the server
 * may interleave them with stream messages.
 *
 * However, a stream/content message is allowed to supersede a previously
 * processed PING with the same sequence number. This handles cases where
 * the server later sends authoritative stream content for a sequence that
 * was temporarily occupied by a session-level PING.
 */
export class SequenceBuffer {
  private readonly pending = new Map<number, ServerMessage>();

  /**
   * Sequence numbers that were consumed as PING messages.
   *
   * We keep these so that if a real stream message later arrives with
   * the same seq, it is not incorrectly discarded as a duplicate.
   */
  private readonly processedPingSequences = new Set<number>();

  private activeStreamId: string | null = null;

  private processedSequence: number;

  private lastRecoverableSeq = 0;

  private lastContentSequence = 0;

  constructor(lastProcessedSeq = 0) {
    if (
      !Number.isSafeInteger(lastProcessedSeq) ||
      lastProcessedSeq < 0
    ) {
      throw new RangeError(
        "lastProcessedSeq must be a non-negative safe integer",
      );
    }

    this.processedSequence = lastProcessedSeq;
  }

  get lastContentSeq(): number {
    return this.lastContentSequence;
  }

  get lastResumeSeq(): number {
    return this.lastRecoverableSeq;
  }

  get hasActiveStream(): boolean {
    return this.activeStreamId !== null;
  }

  get currentStreamId(): string | null {
    return this.activeStreamId;
  }

  get lastProcessedSeq(): number {
    return this.processedSequence;
  }

  get nextExpectedSeq(): number {
    return this.processedSequence + 1;
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  /**
   * Adds an event and returns every event that can now be processed.
   */
  push(message: ServerMessage): ServerMessage[] {
    /*
     * Special case:
     *
     * A PING may already have consumed this sequence number.
     * If real stream content later arrives with the same seq,
     * allow the stream message through.
     *
     * Example:
     *
     *   PING       seq 25
     *   STREAM_END seq 25
     *
     * STREAM_END must not be discarded as a duplicate.
     */
    if (
      message.type !== "PING" &&
      message.seq <= this.processedSequence &&
      this.processedPingSequences.has(message.seq)
    ) {
      console.log(
        "🔁 Replacing previously processed PING sequence:",
        message.seq,
        "with:",
        message.type,
      );

      this.processedPingSequences.delete(message.seq);

      this.trackContentMessage(message);

      return [message];
    }

    /*
     * Normal duplicate / stale message.
     */
    if (message.seq <= this.processedSequence) {
      return [];
    }

    /*
     * Something is already waiting at this sequence.
     */
    const existing = this.pending.get(message.seq);

    if (existing) {
      /*
       * Prefer real stream content over a PING.
       *
       * Example:
       *
       * PING seq 5 arrives first
       * TOOL_CALL seq 5 arrives before seq 4
       *
       * Replace the buffered PING with TOOL_CALL.
       */
      if (
        existing.type === "PING" &&
        message.type !== "PING"
      ) {
        console.log(
          "🔁 Replacing buffered PING at seq:",
          message.seq,
          "with:",
          message.type,
        );

        this.pending.set(message.seq, message);

        return this.drain();
      }

      /*
       * Otherwise treat it as a duplicate.
       */
      return [];
    }

    this.pending.set(message.seq, message);

    return this.drain();
  }

  /**
   * Discards buffered events and starts expecting the event after
   * `lastProcessedSeq`.
   */
  reset(lastProcessedSeq = 0): void {
    if (
      !Number.isSafeInteger(lastProcessedSeq) ||
      lastProcessedSeq < 0
    ) {
      throw new RangeError(
        "lastProcessedSeq must be a non-negative safe integer",
      );
    }

    this.pending.clear();

    this.processedPingSequences.clear();

    this.processedSequence = lastProcessedSeq;

    this.activeStreamId = null;

    this.lastContentSequence = lastProcessedSeq;

    this.lastRecoverableSeq = lastProcessedSeq;
  }

  /**
   * Tracks stream/content state separately from session-level messages.
   */
  private trackContentMessage(message: ServerMessage): void {
    if (
      message.type === "TOKEN" ||
      message.type === "TOOL_CALL" ||
      message.type === "TOOL_RESULT" ||
      message.type === "STREAM_END"
    ) {
      this.lastContentSequence = message.seq;
      this.lastRecoverableSeq = message.seq;
    }

    if (
      message.type === "TOKEN" ||
      message.type === "TOOL_CALL" ||
      message.type === "TOOL_RESULT"
    ) {
      if ("stream_id" in message) {
        this.activeStreamId = message.stream_id;
      }
    }

    if (message.type === "STREAM_END") {
      if (
        this.activeStreamId === null ||
        this.activeStreamId === message.stream_id
      ) {
        this.activeStreamId = null;
      }
    }
  }

  private drain(): ServerMessage[] {
    const ready: ServerMessage[] = [];

    let nextMessage =
      this.pending.get(this.nextExpectedSeq);

    while (nextMessage !== undefined) {
      this.pending.delete(nextMessage.seq);

      this.processedSequence = nextMessage.seq;

      /*
       * Remember that this sequence was consumed only by
       * a session-level PING.
       */
      if (nextMessage.type === "PING") {
        this.processedPingSequences.add(
          nextMessage.seq,
        );
      } else {
        this.trackContentMessage(nextMessage);
      }

      ready.push(nextMessage);

      nextMessage =
        this.pending.get(this.nextExpectedSeq);
    }

    return ready;
  }
}