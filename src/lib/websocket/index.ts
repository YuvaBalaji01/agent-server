import { WebSocketManager } from "./WebSocketManager";

export const wsManager = new WebSocketManager("ws://localhost:4747/ws");
export * from "./ReconnectionManager";