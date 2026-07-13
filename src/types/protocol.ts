// ================================
// Client → Server Messages
// ================================

export interface UserMessage {
  type: "USER_MESSAGE";
  content: string;
}

export interface PongMessage {
  type: "PONG";
  echo: string;
}

export interface ResumeMessage {
  type: "RESUME";
  last_seq: number;
}

export interface ToolAckMessage {
  type: "TOOL_ACK";
  call_id: string;
}

export type ClientMessage =
  | UserMessage
  | PongMessage
  | ResumeMessage
  | ToolAckMessage;

// ================================
// Server → Client Messages
// ================================

interface BaseServerMessage {
  seq: number;
}

export interface TokenMessage extends BaseServerMessage {
  type: "TOKEN";
  stream_id: string;
  text: string;
}

export interface ToolCallMessage extends BaseServerMessage {
  type: "TOOL_CALL";
  call_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  stream_id: string;
}

export interface ToolResultMessage extends BaseServerMessage {
  type: "TOOL_RESULT";
  call_id: string;
  result: Record<string, unknown>;
  stream_id: string;
}

export interface ContextSnapshotMessage extends BaseServerMessage {
  type: "CONTEXT_SNAPSHOT";
  context_id: string;
  data: Record<string, unknown>;
}

export interface PingMessage extends BaseServerMessage {
  type: "PING";
  challenge: string;
}

export interface StreamEndMessage extends BaseServerMessage {
  type: "STREAM_END";
  stream_id: string;
}

export interface ErrorMessage extends BaseServerMessage {
  type: "ERROR";
  code: string;
  message: string;
}

export type ServerMessage =
  | TokenMessage
  | ToolCallMessage
  | ToolResultMessage
  | ContextSnapshotMessage
  | PingMessage
  | StreamEndMessage
  | ErrorMessage;