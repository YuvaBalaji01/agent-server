import { useEffect, useMemo } from "react";
import { EventProcessor } from "@/src/lib/websocket/EventProcessor";
import { ReconnectionManager } from "@/src/lib/websocket/ReconnectionManager";
import { SequenceBuffer } from "@/src/lib/websocket/SequenceBuffer";
import { wsManager } from "@/src/lib/websocket";
import { WebSocketManager } from "@/src/lib/websocket/WebSocketManager";
import { useAgentStore } from "@/src/store/agentStore";

export interface AgentClientDependencies {
  webSocketManager: WebSocketManager;
  sequenceBuffer: SequenceBuffer;
  eventProcessor: EventProcessor;
}

export function useAgentClient(
  dependencies?: AgentClientDependencies,
): void {
  const defaultDependencies = useMemo(
    () => createDefaultDependencies(),
    [],
  );

  const reconnectManager = useMemo(
    () => new ReconnectionManager(),
    [],
  );

  const client = dependencies ?? defaultDependencies;

  useEffect(() => {
    const unsubscribeEvents = client.eventProcessor.subscribe((event) => {
      useAgentStore.getState().dispatch(event);
    });

    const unsubscribeMessages = client.webSocketManager.onMessage((message) => {
      const orderedMessages = client.sequenceBuffer.push(message);
      let shouldReset = false;
      for (const orderedMessage of orderedMessages) {
        const streamId =
          "stream_id" in orderedMessage
            ? orderedMessage.stream_id
            : "NO_STREAM";

        console.log(
          "PROCESSING:",
          streamId,
          orderedMessage.type,
          orderedMessage.seq
        );
        client.eventProcessor.process(orderedMessage);

        if (orderedMessage.type === "STREAM_END") {
          shouldReset = true;
        }
      }

      if (shouldReset) {
        client.sequenceBuffer.reset();
      }
    });

    const unsubscribeConnection =
      client.webSocketManager.onConnectionChange((connected) => {
        useAgentStore
          .getState()
          .dispatch({ type: "CONNECTION_CHANGED", connected });
        // if (client.sequenceBuffer.hasActiveStream) {
        //   console.log(
        //     "⚠ Connection lost during active stream:",
        //     client.sequenceBuffer.currentStreamId,
        //   );
        // }
        if (client.sequenceBuffer.hasActiveStream) console.log("active");
        else console.log("not active");
        if (connected) {
          reconnectManager.reset();
          console.log(client.sequenceBuffer.lastProcessedSeq)
          if (client.sequenceBuffer.lastContentSeq > 0) {
            client.webSocketManager.sendResume(
              client.sequenceBuffer.lastContentSeq,
            );
          }

          return;
        }

        reconnectManager.scheduleReconnect(() => {
          client.webSocketManager.connect();
        });
      });

    client.webSocketManager.connect();

    return () => {
      unsubscribeMessages();
      unsubscribeConnection();
      unsubscribeEvents();

      reconnectManager.reset();

      client.webSocketManager.disconnect();
    };
  }, [client, reconnectManager]);
}

function createDefaultDependencies(): AgentClientDependencies {
  return {
    webSocketManager: wsManager,
    sequenceBuffer: new SequenceBuffer(),
    eventProcessor: new EventProcessor(wsManager),
  };
}