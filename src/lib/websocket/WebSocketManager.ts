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

        this.messageHandlers.forEach((handler) => handler(message));
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
    const msg: UserMessage = {
      type: "USER_MESSAGE",
      content,
    };

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

  onMessage(handler: MessageHandler) {
    this.messageHandlers.push(handler);
  }

  onConnectionChange(handler: ConnectionHandler) {
    this.connectionHandlers.push(handler);
  }

  private notifyConnection(state: boolean) {
    this.connectionHandlers.forEach((handler) => handler(state));
  }
}