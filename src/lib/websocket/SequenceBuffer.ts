import type { ServerMessage } from "@/src/types/protocol";

/**
 * Holds server events until their predecessors have arrived.
 *
 * `lastProcessedSeq` is the sequence number immediately before the next
 * expected event. For a new stream whose first event is `seq: 1`, use the
 * default value of `0`.
 */
export class SequenceBuffer {
  private readonly pending = new Map<number, ServerMessage>();

  private processedSequence: number;

  constructor(lastProcessedSeq = 0) {
    if (!Number.isSafeInteger(lastProcessedSeq) || lastProcessedSeq < 0) {
      throw new RangeError("lastProcessedSeq must be a non-negative safe integer");
    }

    this.processedSequence = lastProcessedSeq;
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
   * Adds an event and returns every event that can now be processed in order.
   */
  push(message: ServerMessage): ServerMessage[] {
    if (message.seq <= this.processedSequence || this.pending.has(message.seq)) {
      return [];
    }

    this.pending.set(message.seq, message);
    return this.drain();
  }

  /**
   * Discards buffered events and starts expecting the event after `lastProcessedSeq`.
   */
  reset(lastProcessedSeq = 0): void {
    if (!Number.isSafeInteger(lastProcessedSeq) || lastProcessedSeq < 0) {
      throw new RangeError("lastProcessedSeq must be a non-negative safe integer");
    }

    this.pending.clear();
    this.processedSequence = lastProcessedSeq;
  }

  private drain(): ServerMessage[] {
    const ready: ServerMessage[] = [];
    let nextMessage = this.pending.get(this.nextExpectedSeq);

    while (nextMessage !== undefined) {
      this.pending.delete(nextMessage.seq);
      this.processedSequence = nextMessage.seq;
      ready.push(nextMessage);
      nextMessage = this.pending.get(this.nextExpectedSeq);
    }

    return ready;
  }
}
