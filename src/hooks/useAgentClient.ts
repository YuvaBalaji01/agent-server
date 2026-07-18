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
    // Tracks the stream currently being processed.
    let currentStreamId: string | null = null;

    // Timer associated with the current stream.
    let responseTimer: ReturnType<typeof setTimeout> | null = null;

    // Increase this if your server normally needs more time.
    const RESPONSE_TIMEOUT = 20000;

    const clearResponseTimer = () => {
      if (responseTimer) {
        clearTimeout(responseTimer);
        responseTimer = null;
      }
    };

    const startResponseTimer = (streamId: string) => {
      clearResponseTimer();

      console.log(
        "⏱ Starting response timer for stream:",
        streamId,
      );

      responseTimer = setTimeout(() => {
        if (currentStreamId !== streamId) {
          return;
        }

        console.log(
          "⚠️ Response timeout. STREAM_END not received for stream:",
          streamId,
        );

        const lastSeq = client.sequenceBuffer.lastContentSeq;

        if (lastSeq > 0) {
          console.log(
            "🔄 Sending RESUME after response timeout:",
            streamId,
            "from seq:",
            lastSeq,
          );

          client.webSocketManager.sendResume(lastSeq);
        }
      }, RESPONSE_TIMEOUT);
    };

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
            : null;

        console.log(
          "PROCESSING:",
          streamId ?? "NO_STREAM",
          orderedMessage.type,
          orderedMessage.seq,
        );

        /*
         * Detect the active response stream.
         *
         * We start tracking when the first stream-specific content
         * message arrives.
         */
        if (
          streamId &&
          (
            orderedMessage.type === "TOKEN" ||
            orderedMessage.type === "TOOL_CALL" ||
            orderedMessage.type === "TOOL_RESULT"
          )
        ) {
          if (currentStreamId === null) {
            currentStreamId = streamId;

            console.log(
              "🟢 Active stream started:",
              currentStreamId,
            );

            startResponseTimer(currentStreamId);
          }
        }

        /*
         * STREAM_END must belong to the currently active stream.
         */
        if (orderedMessage.type === "STREAM_END") {
          if (orderedMessage.stream_id === currentStreamId) {
            console.log(
              "✅ Valid STREAM_END received for:",
              currentStreamId,
            );

            // Process STREAM_END so Zustand/UI marks the stream finished.
            client.eventProcessor.process(orderedMessage);

            // Stop the timeout.
            clearResponseTimer();

            // Current response is finished.
            currentStreamId = null;

            // SequenceBuffer can now be reset.
            shouldReset = true;

            continue;
          }

          /*
           * STREAM_END belongs to some other/old stream.
           * Do not finish the active response.
           */
          console.warn(
            "⚠ Ignoring STREAM_END from unexpected stream:",
            orderedMessage.stream_id,
            "Current stream:",
            currentStreamId,
          );

          continue;
        }

        /*
         * Normal message processing.
         */
        client.eventProcessor.process(orderedMessage);
      }

      if (shouldReset) {
        console.log("🔄 Resetting SequenceBuffer");

        client.sequenceBuffer.reset();
      }
    });

    const unsubscribeConnection =
      client.webSocketManager.onConnectionChange((connected) => {
        useAgentStore
          .getState()
          .dispatch({
            type: "CONNECTION_CHANGED",
            connected,
          });

        if (connected) {
          console.log("✅ WebSocket reconnected");

          reconnectManager.reset();

          /*
           * If a response was interrupted, try to resume it.
           */
          if (
            currentStreamId !== null &&
            client.sequenceBuffer.lastContentSeq > 0
          ) {
            console.log(
              "🔄 Resuming stream:",
              currentStreamId,
              "from seq:",
              client.sequenceBuffer.lastContentSeq,
            );

            client.webSocketManager.sendResume(
              client.sequenceBuffer.lastContentSeq,
            );
          }

          return;
        }

        console.log(
          "❌ WebSocket disconnected",
          "Active stream:",
          currentStreamId,
        );

        /*
         * IMPORTANT:
         * We DO NOT clear currentStreamId here.
         *
         * We also DO NOT reset SequenceBuffer.
         *
         * This allows the response to continue after reconnect.
         */

        reconnectManager.scheduleReconnect(() => {
          console.log("🔄 Attempting WebSocket reconnect");

          client.webSocketManager.connect();
        });
      });

    client.webSocketManager.connect();

    return () => {
      unsubscribeMessages();
      unsubscribeConnection();
      unsubscribeEvents();

      reconnectManager.reset();

      clearResponseTimer();

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