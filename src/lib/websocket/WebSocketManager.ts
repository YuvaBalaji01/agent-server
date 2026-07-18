import type {
  ClientMessage,
  ServerMessage,
  PongMessage,
  ResumeMessage,
  ToolAckMessage,
  UserMessage,
} from "@/src/types/protocol";

type MessageHandler = (message: ServerMessage) => void;
type ConnectionHandler = (connected: boolean) => void;

export class WebSocketManager {
  private socket: WebSocket | null = null;

  private readonly url: string;

  private messageHandlers: MessageHandler[] = [];
  private connectionHandlers: ConnectionHandler[] = [];

  // Stores the most recently sent user message.
  // Used to retry when an active response is abandoned.
  private lastUserMessage: string | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    this.socket = new WebSocket(this.url);

    this.socket.onopen = () => {
      console.log("✅ Connected to Agent Server");
      this.notifyConnection(true);
    };

    this.socket.onclose = () => {
      console.log("❌ Disconnected");
      this.notifyConnection(false);
    };

    this.socket.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;

        console.log("📩", message);

        for (const handler of [...this.messageHandlers]) {
          handler(message);
        }
      } catch (err) {
        console.error("Invalid message", err);
      }
    };
  }

  disconnect() {
    this.socket?.close();
  }

  send(message: ClientMessage) {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      console.warn("Socket not connected");
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  sendUserMessage(content: string) {
    // Remember the message in case the response gets interrupted.
    this.lastUserMessage = content;

    const msg: UserMessage = {
      type: "USER_MESSAGE",
      content,
    };

    this.send(msg);
  }

  /**
   * Resends the most recently sent user message.
   *
   * Used when:
   * 1. A response stream starts.
   * 2. The connection is interrupted.
   * 3. Server reconnects but has forgotten the old stream.
   * 4. We abandon the partial response.
   * 5. We resend the original user request.
   */
  resendLastUserMessage(): void {
    if (this.lastUserMessage === null) {
      console.warn("⚠️ No user message available to resend");
      return;
    }

    console.log(
      "📤 Resending last user message:",
      this.lastUserMessage,
    );

    const msg: UserMessage = {
      type: "USER_MESSAGE",
      content: this.lastUserMessage,
    };

    // Send directly instead of calling sendUserMessage().
    this.send(msg);
  }

  sendPong(challenge: string) {
    const msg: PongMessage = {
      type: "PONG",
      echo: challenge,
    };

    this.send(msg);
  }

  sendResume(lastSeq: number) {
    const msg: ResumeMessage = {
      type: "RESUME",
      last_seq: lastSeq,
    };

    this.send(msg);
  }

  sendToolAck(callId: string) {
    const msg: ToolAckMessage = {
      type: "TOOL_ACK",
      call_id: callId,
    };

    this.send(msg);
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);

    return () => {
      this.messageHandlers = this.messageHandlers.filter(
        (registeredHandler) => registeredHandler !== handler,
      );
    };
  }

  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.push(handler);

    return () => {
      this.connectionHandlers = this.connectionHandlers.filter(
        (registeredHandler) => registeredHandler !== handler,
      );
    };
  }

  private notifyConnection(state: boolean) {
    for (const handler of [...this.connectionHandlers]) {
      handler(state);
    }
  }
}