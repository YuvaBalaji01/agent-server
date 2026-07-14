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
    <section className="flex h-screen overflow-hidden bg-slate-950">

      {/* ================= LEFT ================= */}

      <div className="flex min-w-0 flex-1 flex-col">

        {/* Chat Messages */}

        <div className="flex-1 overflow-y-auto px-8 py-6">

          <div className="mx-auto flex max-w-4xl flex-col gap-5">

            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
              />
            ))}

            <div ref={bottomRef} />

          </div>

        </div>

        {/* Fixed Input */}

        <div className="shrink-0 border-t border-slate-800 bg-slate-950">

          <ChatInput webSocketManager={webSocketManager} />

        </div>

      </div>

      {/* ================= RIGHT ================= */}

      <aside className="hidden h-screen w-[380px] shrink-0 border-l border-slate-800 bg-slate-900 xl:flex xl:flex-col">

        {/* Header */}

        <div className="shrink-0 border-b border-slate-800 p-6">

          <h2 className="text-3xl font-bold text-white">
            Inspector
          </h2>

          <div className="mt-5 flex items-center gap-3">

            <div
              className={`h-3 w-3 rounded-full ${
                connected
                  ? "bg-green-500"
                  : "bg-red-500"
              }`}
            />

            <span className="text-base text-white">
              {connected
                ? "Connected"
                : "Disconnected"}
            </span>

          </div>

        </div>

        {/* Scrollable Inspector */}

        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          <ToolPanel />

          <ContextInspector />

          <TimelinePanel />

        </div>

      </aside>

    </section>
  );
}