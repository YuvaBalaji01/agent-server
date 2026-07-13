import { describe, expect, it } from "vitest";

import type { ServerMessage } from "@/src/types/protocol";
import { SequenceBuffer } from "./SequenceBuffer";

function token(seq: number): ServerMessage {
  return {
    type: "TOKEN",
    seq,
    stream_id: "stream-1",
    text: `token-${seq}`,
  };
}

function sequenceOf(messages: ServerMessage[]): number[] {
  return messages.map((message) => message.seq);
}

describe("SequenceBuffer", () => {
  it("starts empty", () => {
    const buffer = new SequenceBuffer();

    expect(buffer.pendingCount).toBe(0);
    expect(buffer.lastProcessedSeq).toBe(0);
    expect(buffer.nextExpectedSeq).toBe(1);
  });

  it("uses its constructor offset as the previously processed sequence", () => {
    const buffer = new SequenceBuffer(4);

    expect(buffer.lastProcessedSeq).toBe(4);
    expect(buffer.nextExpectedSeq).toBe(5);
    expect(buffer.push(token(6))).toEqual([]);
    expect(sequenceOf(buffer.push(token(5)))).toEqual([5, 6]);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid constructor offset of %s",
    (invalidOffset) => {
      expect(() => new SequenceBuffer(invalidOffset)).toThrow(RangeError);
    },
  );

  it("returns in-order messages immediately", () => {
    const buffer = new SequenceBuffer();

    expect(sequenceOf(buffer.push(token(1)))).toEqual([1]);
    expect(sequenceOf(buffer.push(token(2)))).toEqual([2]);
    expect(buffer.pendingCount).toBe(0);
  });

  it("buffers out-of-order messages until their predecessor arrives", () => {
    const buffer = new SequenceBuffer();

    expect(buffer.push(token(2))).toEqual([]);
    expect(buffer.pendingCount).toBe(1);
    expect(sequenceOf(buffer.push(token(1)))).toEqual([1, 2]);
    expect(buffer.pendingCount).toBe(0);
  });

  it("ignores duplicate processed and pending sequence values", () => {
    const buffer = new SequenceBuffer();

    expect(buffer.push(token(2))).toEqual([]);
    expect(buffer.push(token(2))).toEqual([]);
    expect(buffer.pendingCount).toBe(1);
    expect(sequenceOf(buffer.push(token(1)))).toEqual([1, 2]);
    expect(buffer.push(token(2))).toEqual([]);
  });

  it("processes a fully reversed sequence after the first gap is filled", () => {
    const buffer = new SequenceBuffer();

    expect(buffer.push(token(3))).toEqual([]);
    expect(buffer.push(token(2))).toEqual([]);
    expect(sequenceOf(buffer.push(token(1)))).toEqual([1, 2, 3]);
  });

  it("retains later messages when a sequence gap remains", () => {
    const buffer = new SequenceBuffer();

    expect(sequenceOf(buffer.push(token(1)))).toEqual([1]);
    expect(buffer.push(token(3))).toEqual([]);
    expect(buffer.lastProcessedSeq).toBe(1);
    expect(buffer.nextExpectedSeq).toBe(2);
    expect(buffer.pendingCount).toBe(1);
  });

  it("replays buffered messages in order when the missing event arrives", () => {
    const buffer = new SequenceBuffer();

    buffer.push(token(1));
    buffer.push(token(4));
    buffer.push(token(3));
    expect(sequenceOf(buffer.push(token(2)))).toEqual([2, 3, 4]);
    expect(buffer.lastProcessedSeq).toBe(4);
  });

  it("reset clears pending messages and restores the default offset", () => {
    const buffer = new SequenceBuffer();

    buffer.push(token(3));
    buffer.reset();

    expect(buffer.pendingCount).toBe(0);
    expect(buffer.lastProcessedSeq).toBe(0);
    expect(sequenceOf(buffer.push(token(1)))).toEqual([1]);
  });

  it("reset accepts an offset for a recovered stream", () => {
    const buffer = new SequenceBuffer();

    buffer.push(token(2));
    buffer.reset(10);

    expect(buffer.pendingCount).toBe(0);
    expect(buffer.nextExpectedSeq).toBe(11);
    expect(sequenceOf(buffer.push(token(11)))).toEqual([11]);
  });
});
