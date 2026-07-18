# Architectural Decisions

## 1. Sequence-Based Ordering and Deduplication

Incoming WebSocket messages contain a `seq` number and may arrive out of order or be duplicated. I implemented a `SequenceBuffer` backed by a `Map<number, ServerMessage>`.

The map temporarily stores messages that arrive before their predecessors. Messages are released for processing only when the next expected sequence number is available. Messages that have already been processed, or duplicates already present in the pending map, are ignored. This provides ordered processing and prevents duplicate rendering.

Stream-specific events are also validated against the active `stream_id` so stale events from an older stream do not incorrectly affect the currently active response.

## 2. Preventing Layout Shift During Tool Calls

Assistant messages are represented as ordered segments instead of rebuilding one large text block.

A response can contain text segments and tool-call segments. When a `TOOL_CALL` interrupts streaming, the existing text remains unchanged and a tool segment is appended. When token streaming continues after the tool result, streaming resumes in a text segment after the tool card.

This keeps already rendered content stable and avoids replacing the complete response during tool-call interruptions, reducing unnecessary reflow and flicker.

## 3. Reconnection and State Recovery

The client tracks WebSocket connection state separately from the active response stream. Incoming socket messages first pass through sequence ordering and validation before they are processed by `EventProcessor` and stored in Zustand.

The `SequenceBuffer` therefore represents what the application has actually consumed in order, rather than simply everything the socket has received. The DOM renders state produced only after this ordered processing step.

When the connection drops, `ReconnectionManager` attempts to reconnect. The client uses the active stream information and the last processed content sequence when attempting recovery. If the previous stream cannot be safely recovered, the interrupted response can be discarded and restarted as a fresh request. Stream-ID validation prevents delayed messages from an abandoned stream from corrupting the new response.

## 4. Handling 50 Concurrent Agent Streams

For an operations dashboard with 50 concurrent streams, I would replace the single active-stream tracking with a registry keyed by `stream_id`.

Each stream would maintain its own sequence buffer, last processed sequence, recovery state, tool-call state, and timeout. I would also use UI virtualization and stream-specific Zustand selectors so updates from one stream do not cause all 50 streams to re-render.

## 5. Handling Responses 100x Longer

For full-document generation, I would avoid repeatedly rebuilding and rendering one continuously growing response string.

I would store streamed content in chunks, batch UI updates, and virtualize large rendered output so only visible content is mounted in the DOM. Completed chunks could also be persisted outside the primary React state, keeping only the active streaming window and required metadata in memory.

This would reduce memory consumption and React rendering overhead while preserving incremental streaming behavior.
