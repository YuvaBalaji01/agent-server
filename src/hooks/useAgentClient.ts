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
    /*
     * Stream currently producing the assistant response.
     */
    let currentStreamId: string | null = null;

    /*
     * Response timeout timer.
     */
    let responseTimer: ReturnType<typeof setTimeout> | null = null;

    /*
     * If true, the current stream was interrupted by a disconnect.
     *
     * When the socket reconnects we will:
     *
     * 1. discard the partial response
     * 2. reset SequenceBuffer
     * 3. resend the last user message
     */
    let shouldRestartAfterReconnect = false;

    /*
     * Prevent accidentally resending multiple times for the
     * same disconnect/reconnect cycle.
     */
    let restartInProgress = false;

    const RESPONSE_TIMEOUT = 5000;

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

    /*
     * Events produced by EventProcessor go into Zustand.
     */
    const unsubscribeEvents =
      client.eventProcessor.subscribe((event) => {
        useAgentStore.getState().dispatch(event);
      });

    /*
     * Process incoming WebSocket messages.
     */
   const unsubscribeMessages =
  client.webSocketManager.onMessage((message) => {
    /*
     * IMPORTANT:
     * Validate stream-specific messages BEFORE they enter
     * SequenceBuffer.
     *
     * Otherwise an old/incorrect stream message with the same
     * sequence number can advance the buffer and cause the valid
     * message to be discarded as a duplicate.
     */
    const incomingStreamId =
      "stream_id" in message
        ? message.stream_id
        : null;

    /*
     * If we already have an active stream, reject messages
     * belonging to another stream.
     *
     * We specifically protect STREAM_END and stream content here.
     */
    if (
      currentStreamId !== null &&
      incomingStreamId !== null &&
      incomingStreamId !== currentStreamId &&
      (
        message.type === "TOKEN" ||
        message.type === "TOOL_CALL" ||
        message.type === "TOOL_RESULT" ||
        message.type === "STREAM_END"
      )
    ) {
      console.warn(
        "⚠️ Discarding message from unexpected stream BEFORE SequenceBuffer:",
        {
          type: message.type,
          seq: message.seq,
          incomingStreamId,
          currentStreamId,
        },
      );

      // CRITICAL:
      // Do not push this message into SequenceBuffer.
      return;
    }

    /*
     * Message is valid for the current stream.
     * Now it is safe to give it to SequenceBuffer.
     */
    const orderedMessages =
      client.sequenceBuffer.push(message);

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
       * Detect stream activity.
       */
      if (
        streamId &&
        (
          orderedMessage.type === "TOKEN" ||
          orderedMessage.type === "TOOL_CALL" ||
          orderedMessage.type === "TOOL_RESULT"
        )
      ) {
        /*
         * No active stream means this is the beginning
         * of a new response.
         */
        if (currentStreamId === null) {
          currentStreamId = streamId;

          restartInProgress = false;

          console.log(
            "🟢 Active stream started:",
            currentStreamId,
          );

          startResponseTimer(currentStreamId);
        }

        /*
         * Only activity from the CURRENT stream
         * can restart the inactivity timer.
         */
        if (streamId === currentStreamId) {
          startResponseTimer(currentStreamId);
        }
      }

      /*
       * STREAM_END validation.
       *
       * This is a second safety check.
       * Normally invalid STREAM_END messages should already
       * have been discarded before SequenceBuffer.push().
       */
      if (orderedMessage.type === "STREAM_END") {
        if (
          currentStreamId !== null &&
          orderedMessage.stream_id === currentStreamId
        ) {
          console.log(
            "✅ Valid STREAM_END received for:",
            currentStreamId,
          );

          client.eventProcessor.process(
            orderedMessage,
          );

          clearResponseTimer();

          currentStreamId = null;

          shouldRestartAfterReconnect = false;
          restartInProgress = false;

          shouldReset = true;

          continue;
        }

        console.warn(
          "⚠️ Ignoring unexpected STREAM_END:",
          orderedMessage.stream_id,
          "Current stream:",
          currentStreamId,
        );

        continue;
      }

      /*
       * Normal processing.
       */
      client.eventProcessor.process(
        orderedMessage,
      );
    }

    if (shouldReset) {
      console.log(
        "🔄 Resetting SequenceBuffer after STREAM_END",
      );

      client.sequenceBuffer.reset();
    }
  });
    /*
     * Handle WebSocket connection changes.
     */
    const unsubscribeConnection =
      client.webSocketManager.onConnectionChange(
        (connected) => {
          useAgentStore
            .getState()
            .dispatch({
              type: "CONNECTION_CHANGED",
              connected,
            });

          /*
           * ==============================
           * RECONNECTED
           * ==============================
           */
          if (connected) {
            console.log(
              "✅ WebSocket connected/reconnected",
            );

            reconnectManager.reset();

            /*
             * The previous stream was interrupted.
             *
             * Instead of RESUME:
             *
             * discard old response
             * reset buffer
             * resend original user message
             */
            if (
              shouldRestartAfterReconnect &&
              currentStreamId !== null &&
              !restartInProgress
            ) {
              restartInProgress = true;

              const abandonedStreamId =
                currentStreamId;

              console.warn(
                "🗑 Abandoning interrupted stream:",
                abandonedStreamId,
              );

              /*
               * Stop old stream timeout.
               */
              clearResponseTimer();

              /*
               * Remove incomplete assistant response
               * and tool calls from UI.
               */
              useAgentStore
                .getState()
                .discardStream(
                  abandonedStreamId,
                );

              /*
               * Forget old stream locally.
               */
              currentStreamId = null;

              shouldRestartAfterReconnect = false;

              /*
               * Very important:
               *
               * Old sequence numbers must not affect
               * the fresh server response.
               */
              console.log(
                "🔄 Resetting SequenceBuffer before resend",
              );

              client.sequenceBuffer.reset();

              /*
               * Send the same user request again.
               */
              console.log(
                "📤 Resending last user message",
              );

              client.webSocketManager
                .resendLastUserMessage();

              return;
            }

            return;
          }

          /*
           * ==============================
           * DISCONNECTED
           * ==============================
           */

          console.error(
            "❌ WebSocket disconnected",
            "Active stream:",
            currentStreamId,
          );

          /*
           * If we disconnected while processing a response,
           * mark it for restart after reconnection.
           */
          if (currentStreamId !== null) {
            console.warn(
              "⚠️ Active response interrupted:",
              currentStreamId,
            );

            shouldRestartAfterReconnect = true;

            /*
             * The old timer is no longer useful.
             */
            clearResponseTimer();
          }

          /*
           * Reconnect socket.
           */
          reconnectManager.scheduleReconnect(
            () => {
              console.log(
                "🔄 Attempting WebSocket reconnect",
              );

              client.webSocketManager.connect();
            },
          );
        },
      );

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
    eventProcessor: new EventProcessor(
      wsManager,
    ),
  };
}