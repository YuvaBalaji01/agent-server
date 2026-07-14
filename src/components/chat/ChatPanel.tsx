"use client";

import { useEffect, useRef } from "react";
import { ToolPanel } from "./ToolPanel";
import type { WebSocketManager } from "@/src/lib/websocket/WebSocketManager";
import { useAgentStore } from "@/src/store/agentStore";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";

interface ChatPanelProps {
  webSocketManager?: WebSocketManager;
}

export function ChatPanel({ webSocketManager }: ChatPanelProps) {
  const messages = useAgentStore((state) => state.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <section className="mx-auto flex h-full w-full max-w-4xl flex-col bg-white dark:bg-slate-950">
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
      <ToolPanel/>
      <div className="sticky bottom-0">
        <ChatInput webSocketManager={webSocketManager} />
      </div>
    </section>
  );
}
