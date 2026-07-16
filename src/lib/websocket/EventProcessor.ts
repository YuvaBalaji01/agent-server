import type {
  AgentEvent,
  ContextUpdatedEvent,
  ErrorOccurredEvent,
  StreamFinishedEvent,
  TokenAppendedEvent,
  ToolCallCompletedEvent,
  ToolCallStartedEvent,
} from "@/src/types/agent-events";
import type {
  ContextSnapshotMessage,
  ErrorMessage,
  PingMessage,
  ServerMessage,
  StreamEndMessage,
  TokenMessage,
  ToolCallMessage,
  ToolResultMessage,
} from "@/src/types/protocol";
import { WebSocketManager } from "./WebSocketManager";

export type AgentEventListener = (event: AgentEvent) => void;

export class EventProcessor {
  private readonly listeners = new Set<AgentEventListener>();

  private destroyed = false;

  constructor(private readonly webSocketManager: WebSocketManager) {}

  process(message: ServerMessage): void {
    if (this.destroyed) {
      return;
    }

    switch (message.type) {
      case "TOKEN":
        this.handleToken(message);
        return;
      case "PING":
        this.handlePing(message);
        return;
      case "TOOL_CALL":
        this.handleToolCall(message);
        return;
      case "TOOL_RESULT":
        this.handleToolResult(message);
        return;
      case "CONTEXT_SNAPSHOT":
        this.handleContextSnapshot(message);
        return;
      case "STREAM_END":
        console.log("EventProcessor got STREAM_END");
        this.handleStreamEnd(message);
        return;
      case "ERROR":
        this.handleError(message);
        return;
    }
  }

  subscribe(listener: AgentEventListener): () => void {
    if (this.destroyed) {
      return () => undefined;
    }

    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
  }

  private emit(event: AgentEvent): void {
    const listeners = [...this.listeners];

    listeners.forEach((listener) => {
      try {
        listener(event);
      } catch {
        // One consumer must not prevent delivery to the other consumers.
      }
    });
  }

  private handleToken(message: TokenMessage): void {
    const event: TokenAppendedEvent = {
      type: "TOKEN_APPENDED",
      seq: message.seq,
      streamId: message.stream_id,
      token: message.text,
    };

    this.emit(event);
  }

  private handlePing(message: PingMessage): void {
    this.performProtocolAction(() => this.webSocketManager.sendPong(message.challenge));
  }

  private handleToolCall(message: ToolCallMessage): void {
    this.performProtocolAction(() => this.webSocketManager.sendToolAck(message.call_id));

    const event: ToolCallStartedEvent = {
      type: "TOOL_CALL_STARTED",
      callId: message.call_id,
      streamId: message.stream_id,
      toolName: message.tool_name,
      args: message.args,
    };

    this.emit(event);
  }

  private handleToolResult(message: ToolResultMessage): void {
    const event: ToolCallCompletedEvent = {
      type: "TOOL_CALL_COMPLETED",
      callId: message.call_id,
      streamId: message.stream_id,
      result: message.result,
    };

    this.emit(event);
  }

  private handleContextSnapshot(message: ContextSnapshotMessage): void {
    const event: ContextUpdatedEvent = {
      type: "CONTEXT_UPDATED",
      contextId: message.context_id,
      data: message.data,
    };

    this.emit(event);
  }

  private handleStreamEnd(message: StreamEndMessage): void {
    const event: StreamFinishedEvent = {
      type: "STREAM_FINISHED",
      streamId: message.stream_id,
    };

    this.emit(event);
  }

  private handleError(message: ErrorMessage): void {
    const event: ErrorOccurredEvent = {
      type: "ERROR_OCCURRED",
      code: message.code,
      message: message.message,
    };

    this.emit(event);
  }

  private performProtocolAction(action: () => void): void {
    try {
      action();
    } catch {
      // Protocol responses are best-effort and must not stop event delivery.
    }
  }
}
