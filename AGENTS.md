# Agent Console

## Stack
- Next.js 15
- TypeScript (strict)
- Tailwind
- Zustand

## Rules

- Never use any.
- Never use @ts-ignore.
- Keep networking independent from React.
- Never modify protocol message formats.
- Keep files small.
- Use classes for protocol handling.
- Use Zustand only for application state.
- Explain architectural changes before implementing them.

## Project

This project connects to a WebSocket AI agent server.

The protocol supports:

- USER_MESSAGE
- TOKEN
- TOOL_CALL
- TOOL_RESULT
- CONTEXT_SNAPSHOT
- PING/PONG
- STREAM_END
- RESUME

Chaos mode includes:

- reconnects
- out-of-order packets
- duplicates
- latency spikes

The architecture should be

WebSocket
↓
SequenceBuffer
↓
EventProcessor
↓
Zustand Store
↓
React UI