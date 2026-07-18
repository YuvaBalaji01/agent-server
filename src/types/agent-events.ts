// ======================================
// Agent Events
// These are application-level events.
// React and Zustand should only consume
// these events, never raw protocol messages.
// ======================================

export interface TokenAppendedEvent {
  type: "TOKEN_APPENDED";

  seq: number;

  streamId: string;

  token: string;
}

export interface ToolCallStartedEvent {
  type: "TOOL_CALL_STARTED";

  callId: string;

  streamId: string;

  toolName: string;

  args: Record<string, unknown>;
}

export interface ToolCallCompletedEvent {
  type: "TOOL_CALL_COMPLETED";

  callId: string;
  toolName: string;
  streamId: string;

  result: Record<string, unknown>;
}

export interface ContextUpdatedEvent {
  type: "CONTEXT_UPDATED";

  contextId: string;

  data: Record<string, unknown>;
}

export interface StreamFinishedEvent {
  type: "STREAM_FINISHED";

  streamId: string;
}

export interface ConnectionChangedEvent {
  type: "CONNECTION_CHANGED";

  connected: boolean;
}

export interface ErrorOccurredEvent {
  type: "ERROR_OCCURRED";

  code: string;

  message: string;
}

export interface UserMessageSentEvent {
  type: "USER_MESSAGE_SENT";

  id: string;

  content: string;
}

export type AgentEvent =
  | UserMessageSentEvent
  | TokenAppendedEvent
  | ToolCallStartedEvent
  | ToolCallCompletedEvent
  | ContextUpdatedEvent
  | StreamFinishedEvent
  | ConnectionChangedEvent
  | ErrorOccurredEvent;