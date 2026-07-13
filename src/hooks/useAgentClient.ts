import { useEffect, useMemo } from "react";

import { EventProcessor } from "@/src/lib/websocket/EventProcessor";
import { SequenceBuffer } from "@/src/lib/websocket/SequenceBuffer";
import { wsManager } from "@/src/lib/websocket";
import { WebSocketManager } from "@/src/lib/websocket/WebSocketManager";
import { useAgentStore } from "@/src/store/agentStore";

export interface AgentClientDependencies {
  webSocketManager: WebSocketManager;
  sequenceBuffer: SequenceBuffer;
  eventProcessor: EventProcessor;
}

export function useAgentClient(dependencies?: AgentClientDependencies): void {
  const defaultDependencies = useMemo(() => createDefaultDependencies(), []);
  const client = dependencies ?? defaultDependencies;

  useEffect(() => {
    const unsubscribeEvents = client.eventProcessor.subscribe((event) => {
      useAgentStore.getState().dispatch(event);
    });
    const unsubscribeMessages = client.webSocketManager.onMessage((message) => {
      const orderedMessages = client.sequenceBuffer.push(message);

      for (const orderedMessage of orderedMessages) {
        client.eventProcessor.process(orderedMessage);
      }
    });
    const unsubscribeConnection = client.webSocketManager.onConnectionChange((connected) => {
      useAgentStore.getState().dispatch({ type: "CONNECTION_CHANGED", connected });
    });

    client.webSocketManager.connect();

    return () => {
      unsubscribeMessages();
      unsubscribeConnection();
      unsubscribeEvents();
      client.webSocketManager.disconnect();
    };
  }, [client]);
}

function createDefaultDependencies(): AgentClientDependencies {
  return {
    webSocketManager: wsManager,
    sequenceBuffer: new SequenceBuffer(),
    eventProcessor: new EventProcessor(wsManager),
  };
}
