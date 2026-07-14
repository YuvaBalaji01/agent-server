import { create } from "zustand";

import type { AgentEvent } from "@/src/types/agent-events";

export interface ChatMessage {
  id: string;
  streamId: string;
  role: "user" | "assistant";
  content: string;
  isStreaming: boolean;
}

export interface ToolCallState {
  callId: string;
  streamId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: "running" | "completed";
  result?: Record<string, unknown>;
}

export interface ContextSnapshot {
  contextId: string;
  data: Record<string, unknown>;
}

export interface AgentError {
  code: string;
  message: string;
}

export interface AgentState {
  connected: boolean;
  messages: ChatMessage[];
  toolCalls: ToolCallState[];
  contextSnapshot: ContextSnapshot | null;
  errors: AgentError[];
  timeline: TimelineEvent[];
  dispatch: (event: AgentEvent) => void;
  reset: () => void;
}

export interface TimelineEvent {
  id: string;
  type: string;
  timestamp: number;
  details: Record<string, unknown>;
}

function createInitialState(): Pick<
  AgentState,
  "connected" | "messages" | "toolCalls" | "contextSnapshot" | "errors" | "timeline"
> {
  return {
    connected: false,
    messages: [],
    toolCalls: [],
    timeline: [],
    contextSnapshot: null,
    errors: [],
  };
}

export const useAgentStore = create<AgentState>((set) => ({
  ...createInitialState(),
  dispatch: (event) => {
  set((state) => ({
    ...reduceEvent(state, event),
    ...appendTimeline(state, event),
  }));
},
  reset: () => {
    set(createInitialState());
  },
}));

function appendUserMessage(
  state: AgentState,
  event: Extract<AgentEvent, { type: "USER_MESSAGE_SENT" }>,
): Partial<AgentState> {
  return {
    messages: [
      ...state.messages,
      {
        id: event.id,
        streamId: event.id,
        role: "user",
        content: event.content,
        isStreaming: false,
      },
    ],
  };
}

function appendTimeline(
  state: AgentState,
  event: AgentEvent,
): Partial<AgentState> {
  return {
    timeline: [
      ...state.timeline,
      {
        id: crypto.randomUUID(),
        type: event.type,
        timestamp: Date.now(),
        details: event,
      },
    ],
  };
}

function reduceEvent(state: AgentState, event: AgentEvent): Partial<AgentState> {
  switch (event.type) {
    case "TOKEN_APPENDED":
      return appendToken(state, event);
    case "STREAM_FINISHED":
      return finishStream(state, event.streamId);
    case "TOOL_CALL_STARTED":
      return startToolCall(state, event);
    case "TOOL_CALL_COMPLETED":
      return completeToolCall(state, event);
    case "CONTEXT_UPDATED":
      return {
        contextSnapshot: {
          contextId: event.contextId,
          data: event.data,
        },
      };
    case "ERROR_OCCURRED":
      return {
        errors: [...state.errors, { code: event.code, message: event.message }],
      };
    case "CONNECTION_CHANGED":
      return { connected: event.connected };
    case "USER_MESSAGE_SENT":
      return appendUserMessage(state, event);
  }
}

function appendToken(
  state: AgentState,
  event: Extract<AgentEvent, { type: "TOKEN_APPENDED" }>,
): Partial<AgentState> {
  const messageIndex = state.messages.findIndex(
    (message) => message.streamId === event.streamId && message.isStreaming,
  );

  if (messageIndex === -1) {
    return {
      messages: [
        ...state.messages,
        {
          id: event.streamId,
          streamId: event.streamId,
          role: "assistant",
          content: event.token,
          isStreaming: true,
        },
      ],
    };
  }

  return {
    messages: state.messages.map((message, index) =>
      index === messageIndex ? { ...message, content: `${message.content}${event.token}` } : message,
    ),
  };
}

function finishStream(state: AgentState, streamId: string): Partial<AgentState> {
  return {
    messages: state.messages.map((message) =>
      message.streamId === streamId && message.isStreaming
        ? { ...message, isStreaming: false }
        : message,
    ),
  };
}

function startToolCall(
  state: AgentState,
  event: Extract<AgentEvent, { type: "TOOL_CALL_STARTED" }>,
): Partial<AgentState> {
  return {
    toolCalls: [
      ...state.toolCalls,
      {
        callId: event.callId,
        streamId: event.streamId,
        toolName: event.toolName,
        args: event.args,
        status: "running",
      },
    ],
  };
}

function completeToolCall(
  state: AgentState,
  event: Extract<AgentEvent, { type: "TOOL_CALL_COMPLETED" }>,
): Partial<AgentState> {
  return {
    toolCalls: state.toolCalls.map((toolCall) =>
      toolCall.callId === event.callId
        ? { ...toolCall, status: "completed", result: event.result }
        : toolCall,
    ),
  };
}
