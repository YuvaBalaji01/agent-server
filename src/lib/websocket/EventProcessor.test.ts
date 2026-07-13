import { describe, expect, it, vi } from "vitest";

import type { AgentEvent } from "@/src/types/agent-events";
import { EventProcessor } from "./EventProcessor";
import { WebSocketManager } from "./WebSocketManager";

function createProcessor() {
  const manager = new WebSocketManager("ws://example.test/ws");
  const sendPong = vi.spyOn(manager, "sendPong").mockImplementation(() => undefined);
  const sendToolAck = vi
    .spyOn(manager, "sendToolAck")
    .mockImplementation(() => undefined);

  return {
    processor: new EventProcessor(manager),
    sendPong,
    sendToolAck,
  };
}

function collectEvents(processor: EventProcessor): AgentEvent[] {
  const events: AgentEvent[] = [];
  processor.subscribe((event) => events.push(event));
  return events;
}

describe("EventProcessor", () => {
  it("emits an individual token event", () => {
    const { processor } = createProcessor();
    const events = collectEvents(processor);

    processor.process({ type: "TOKEN", seq: 1, stream_id: "stream-1", text: "hello" });

    expect(events).toEqual([
      { type: "TOKEN_APPENDED", seq: 1, streamId: "stream-1", token: "hello" },
    ]);
  });

  it("acknowledges a tool call before emitting its start event", () => {
    const { processor, sendToolAck } = createProcessor();
    const events = collectEvents(processor);

    processor.process({
      type: "TOOL_CALL",
      seq: 2,
      call_id: "call-1",
      stream_id: "stream-1",
      tool_name: "search",
      args: { query: "agent console" },
    });

    expect(sendToolAck).toHaveBeenCalledWith("call-1");
    expect(events).toEqual([
      {
        type: "TOOL_CALL_STARTED",
        callId: "call-1",
        streamId: "stream-1",
        toolName: "search",
        args: { query: "agent console" },
      },
    ]);
  });

  it("emits a tool call event when its acknowledgement fails", () => {
    const { processor, sendToolAck } = createProcessor();
    const events = collectEvents(processor);
    sendToolAck.mockImplementation(() => {
      throw new Error("socket closed");
    });

    expect(() =>
      processor.process({
        type: "TOOL_CALL",
        seq: 3,
        call_id: "call-1",
        stream_id: "stream-1",
        tool_name: "search",
        args: {},
      }),
    ).not.toThrow();

    expect(events).toEqual([
      {
        type: "TOOL_CALL_STARTED",
        callId: "call-1",
        streamId: "stream-1",
        toolName: "search",
        args: {},
      },
    ]);
  });

  it("emits a tool completion event", () => {
    const { processor } = createProcessor();
    const events = collectEvents(processor);

    processor.process({
      type: "TOOL_RESULT",
      seq: 3,
      call_id: "call-1",
      stream_id: "stream-1",
      result: { matches: 3 },
    });

    expect(events).toEqual([
      {
        type: "TOOL_CALL_COMPLETED",
        callId: "call-1",
        streamId: "stream-1",
        result: { matches: 3 },
      },
    ]);
  });

  it("responds to an empty ping without emitting an event", () => {
    const { processor, sendPong } = createProcessor();
    const events = collectEvents(processor);

    processor.process({ type: "PING", seq: 4, challenge: "" });

    expect(sendPong).toHaveBeenCalledWith("");
    expect(events).toEqual([]);
  });

  it("does not throw when responding to a ping fails", () => {
    const { processor, sendPong } = createProcessor();
    sendPong.mockImplementation(() => {
      throw new Error("socket closed");
    });

    expect(() => processor.process({ type: "PING", seq: 5, challenge: "check" })).not.toThrow();
  });

  it("emits a context update without diffing the snapshot", () => {
    const { processor } = createProcessor();
    const events = collectEvents(processor);
    const data = { project: "agent-console" };

    processor.process({ type: "CONTEXT_SNAPSHOT", seq: 6, context_id: "ctx-1", data });

    expect(events).toEqual([{ type: "CONTEXT_UPDATED", contextId: "ctx-1", data }]);
  });

  it("emits a stream finished event", () => {
    const { processor } = createProcessor();
    const events = collectEvents(processor);

    processor.process({ type: "STREAM_END", seq: 7, stream_id: "stream-1" });

    expect(events).toEqual([{ type: "STREAM_FINISHED", streamId: "stream-1" }]);
  });

  it("emits an error event", () => {
    const { processor } = createProcessor();
    const events = collectEvents(processor);

    processor.process({ type: "ERROR", seq: 8, code: "SERVER_ERROR", message: "Failed" });

    expect(events).toEqual([
      { type: "ERROR_OCCURRED", code: "SERVER_ERROR", message: "Failed" },
    ]);
  });

  it("stops notifying an unsubscribed listener", () => {
    const { processor } = createProcessor();
    const events: AgentEvent[] = [];
    const unsubscribe = processor.subscribe((event) => events.push(event));

    unsubscribe();
    processor.process({ type: "TOKEN", seq: 9, stream_id: "stream-1", text: "ignored" });

    expect(events).toEqual([]);
  });

  it("notifies multiple listeners in subscription order", () => {
    const { processor } = createProcessor();
    const calls: string[] = [];
    processor.subscribe(() => calls.push("first"));
    processor.subscribe(() => calls.push("second"));

    processor.process({ type: "TOKEN", seq: 10, stream_id: "stream-1", text: "token" });

    expect(calls).toEqual(["first", "second"]);
  });

  it("uses a listener snapshot when a listener unsubscribes another listener", () => {
    const { processor } = createProcessor();
    const calls: string[] = [];
    let unsubscribeSecond: () => void = () => undefined;

    processor.subscribe(() => {
      calls.push("first");
      unsubscribeSecond();
    });
    unsubscribeSecond = processor.subscribe(() => calls.push("second"));

    processor.process({ type: "TOKEN", seq: 11, stream_id: "stream-1", text: "first" });
    processor.process({ type: "TOKEN", seq: 12, stream_id: "stream-1", text: "second" });

    expect(calls).toEqual(["first", "second", "first"]);
  });

  it("continues notifying listeners after a listener throws", () => {
    const { processor } = createProcessor();
    const events: AgentEvent[] = [];
    processor.subscribe(() => {
      throw new Error("consumer failure");
    });
    processor.subscribe((event) => events.push(event));

    processor.process({ type: "TOKEN", seq: 13, stream_id: "stream-1", text: "received" });

    expect(events).toEqual([
      { type: "TOKEN_APPENDED", seq: 13, streamId: "stream-1", token: "received" },
    ]);
  });

  it("is terminal after destroy", () => {
    const { processor, sendPong } = createProcessor();
    const events: AgentEvent[] = [];
    processor.subscribe((event) => events.push(event));

    processor.destroy();
    const unsubscribe = processor.subscribe((event) => events.push(event));
    processor.process({ type: "PING", seq: 14, challenge: "ignored" });
    unsubscribe();

    expect(events).toEqual([]);
    expect(sendPong).not.toHaveBeenCalled();
  });
});
