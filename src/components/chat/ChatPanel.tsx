"use client";

import { useEffect, useRef } from "react";

import type { WebSocketManager } from "@/src/lib/websocket/WebSocketManager";
import { useAgentStore } from "@/src/store/agentStore";

import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";
import { ContextInspector } from "./ContextInspector";
import { TimelinePanel } from "./TimelinePanel";
import { ToolPanel } from "./ToolPanel";

interface ChatPanelProps {
  webSocketManager?: WebSocketManager;
}

export function ChatPanel({ webSocketManager }: ChatPanelProps) {
  const messages = useAgentStore((state) => state.messages);
  const connected = useAgentStore((state) => state.connected);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <section className="flex h-full w-full bg-slate-950">

      {/* Chat Area */}
      <div className="flex flex-1 flex-col">

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
              />
            ))}

            <div ref={bottomRef} />
          </div>
        </div>

        <ChatInput webSocketManager={webSocketManager} />

      </div>

      {/* Inspector */}
      <aside className="hidden w-[380px] border-l border-slate-800 bg-slate-900 xl:flex xl:flex-col">

        <div className="border-b border-slate-800 p-5">

          <h2 className="text-xl font-bold text-white">
            Inspector
          </h2>

          <div className="mt-4 flex items-center gap-2">

            <div
              className={`h-3 w-3 rounded-full ${
                connected
                  ? "bg-green-500"
                  : "bg-red-500"
              }`}
            />

            <span className="text-sm text-slate-300">
              {connected
                ? "Connected"
                : "Disconnected"}
            </span>

          </div>

        </div>

        <div className="flex-1 overflow-y-auto">

          <ToolPanel />

          <ContextInspector />

          <TimelinePanel />

        </div>

      </aside>

    </section>
  );
}