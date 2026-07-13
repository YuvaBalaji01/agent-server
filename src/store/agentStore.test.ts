import { beforeEach, describe, expect, it } from "vitest";

import { useAgentStore } from "./agentStore";

describe("agentStore", () => {
  beforeEach(() => {
    useAgentStore.getState().reset();
  });

  it("updates connection status", () => {
    useAgentStore.getState().dispatch({ type: "CONNECTION_CHANGED", connected: true });

    expect(useAgentStore.getState().connected).toBe(true);
  });

  it("creates and appends to an active assistant message", () => {
    const store = useAgentStore.getState();

    store.dispatch({ type: "TOKEN_APPENDED", seq: 1, streamId: "stream-1", token: "Hello" });
    useAgentStore.getState().dispatch({
      type: "TOKEN_APPENDED",
      seq: 2,
      streamId: "stream-1",
      token: " world",
    });

    expect(useAgentStore.getState().messages).toEqual([
      {
        id: "stream-1",
        streamId: "stream-1",
        role: "assistant",
        content: "Hello world",
        isStreaming: true,
      },
    ]);
  });

  it("finishes only the matching active assistant message", () => {
    const store = useAgentStore.getState();
    store.dispatch({ type: "TOKEN_APPENDED", seq: 1, streamId: "stream-1", token: "one" });
    useAgentStore.getState().dispatch({
      type: "TOKEN_APPENDED",
      seq: 2,
      streamId: "stream-2",
      token: "two",
    });
    useAgentStore.getState().dispatch({ type: "STREAM_FINISHED", streamId: "stream-1" });

    expect(useAgentStore.getState().messages).toMatchObject([
      { streamId: "stream-1", isStreaming: false },
      { streamId: "stream-2", isStreaming: true },
    ]);
  });

  it("stores a running tool call and completes the matching call", () => {
    const store = useAgentStore.getState();
    store.dispatch({
      type: "TOOL_CALL_STARTED",
      callId: "call-1",
      streamId: "stream-1",
      toolName: "search",
      args: { query: "zustand" },
    });
    useAgentStore.getState().dispatch({
      type: "TOOL_CALL_COMPLETED",
      callId: "call-1",
      streamId: "stream-1",
      result: { count: 1 },
    });

    expect(useAgentStore.getState().toolCalls).toEqual([
      {
        callId: "call-1",
        streamId: "stream-1",
        toolName: "search",
        args: { query: "zustand" },
        status: "completed",
        result: { count: 1 },
      },
    ]);
  });

  it("replaces context snapshots and appends errors", () => {
    const store = useAgentStore.getState();
    store.dispatch({
      type: "CONTEXT_UPDATED",
      contextId: "context-1",
      data: { mode: "first" },
    });
    useAgentStore.getState().dispatch({
      type: "CONTEXT_UPDATED",
      contextId: "context-2",
      data: { mode: "second" },
    });
    useAgentStore.getState().dispatch({ type: "ERROR_OCCURRED", code: "ONE", message: "First" });
    useAgentStore.getState().dispatch({ type: "ERROR_OCCURRED", code: "TWO", message: "Second" });

    expect(useAgentStore.getState().contextSnapshot).toEqual({
      contextId: "context-2",
      data: { mode: "second" },
    });
    expect(useAgentStore.getState().errors).toEqual([
      { code: "ONE", message: "First" },
      { code: "TWO", message: "Second" },
    ]);
  });

  it("restores fresh initial state", () => {
    const store = useAgentStore.getState();
    store.dispatch({ type: "CONNECTION_CHANGED", connected: true });
    useAgentStore.getState().dispatch({ type: "TOKEN_APPENDED", seq: 1, streamId: "stream-1", token: "text" });
    useAgentStore.getState().dispatch({ type: "ERROR_OCCURRED", code: "FAIL", message: "Failure" });

    useAgentStore.getState().reset();

    expect(useAgentStore.getState()).toMatchObject({
      connected: false,
      messages: [],
      toolCalls: [],
      contextSnapshot: null,
      errors: [],
    });
  });
});
