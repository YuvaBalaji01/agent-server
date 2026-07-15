import { create } from "zustand";

import type { AgentEvent } from "@/src/types/agent-events";

export interface TextSegment {
  type: "text";
  id: string;
  content: string;
}

export interface ToolSegment {
  type: "tool_call";
  id: string;
  callId: string;
}

export type MessageSegment = TextSegment | ToolSegment;

export interface ChatMessage {
  id: string;
  streamId: string;
  role: "user" | "assistant";
  segments: MessageSegment[];
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

export interface TimelineEvent {
  id: string;
  type: string;
  timestamp: number;
  details: Record<string, unknown>;
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
        isStreaming: false,
        segments: [
          {
            type: "text",
            id: crypto.randomUUID(),
            content: event.content,
          },
        ],
      },
    ],
  };
}

function appendTimeline(state: AgentState, event: AgentEvent): Partial<AgentState> {
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

/**
 * Appends a token to the currently-streaming message for this streamId.
 *
 * - If the message's last segment is text, extend it in place (no new
 *   segment, no reflow of anything above it).
 * - If the last segment is a tool_call (i.e. we just resumed after a
 *   TOOL_RESULT), start a brand-new text segment. This is what makes
 *   "resume from exactly where it paused" work without touching the
 *   frozen text or duplicating anything.
 */
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
          id: crypto.randomUUID(),
          streamId: event.streamId,
          role: "assistant",
          isStreaming: true,
          segments: [
            {
              type: "text",
              id: crypto.randomUUID(),
              content: event.token,
            },
          ],
        },
      ],
    };
  }

  return {
    messages: state.messages.map((message, index) => {
      if (index !== messageIndex) {
        return message;
      }

      const segments = message.segments;
      const lastSegment = segments[segments.length - 1];

      if (lastSegment && lastSegment.type === "text") {
        return {
          ...message,
          segments: segments.map((segment, segIndex) =>
            segIndex === segments.length - 1
              ? { ...segment, content: `${segment.content}${event.token}` }
              : segment,
          ),
        };
      }

      return {
        ...message,
        segments: [
          ...segments,
          {
            type: "text",
            id: crypto.randomUUID(),
            content: event.token,
          },
        ],
      };
    }),
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

/**
 * Freezes the in-progress text by appending a tool_call segment right
 * after it — the existing segments are never mutated, only appended to,
 * so earlier text/tool cards can never be overwritten.
 */
function startToolCall(
  state: AgentState,
  event: Extract<AgentEvent, { type: "TOOL_CALL_STARTED" }>,
): Partial<AgentState> {
  const toolCall: ToolCallState = {
    callId: event.callId,
    streamId: event.streamId,
    toolName: event.toolName,
    args: event.args,
    status: "running",
  };

  const toolSegment: ToolSegment = {
    type: "tool_call",
    id: event.callId,
    callId: event.callId,
  };

  const messageIndex = state.messages.findIndex(
    (message) => message.streamId === event.streamId && message.isStreaming,
  );

  if (messageIndex === -1) {
    // Tool call arrived before any tokens for this stream — still give it
    // a message slot so it renders in the right place once tokens resume.
    return {
      toolCalls: [...state.toolCalls, toolCall],
      messages: [
        ...state.messages,
        {
          id: crypto.randomUUID(),
          streamId: event.streamId,
          role: "assistant",
          isStreaming: true,
          segments: [toolSegment],
        },
      ],
    };
  }

  return {
    toolCalls: [...state.toolCalls, toolCall],
    messages: state.messages.map((message, index) =>
      index === messageIndex
        ? { ...message, segments: [...message.segments, toolSegment] }
        : message,
    ),
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