"use client";

import { useAgentStore, type ChatMessage as ChatMessageModel } from "@/src/store/agentStore";
import { ToolCard } from "./ToolCard";

interface ChatMessageProps {
  message: ChatMessageModel;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <article className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex max-w-[85%] flex-col gap-2 sm:max-w-[75%] ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        {message.segments.map((segment, index) => {
          if (segment.type === "tool_call") {
            return <ToolSegmentCard key={segment.id} callId={segment.callId} />;
          }

          const isLastSegment = index === message.segments.length - 1;

          return (
            <div
              key={segment.id}
              className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                isUser
                  ? "rounded-br-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "rounded-bl-md bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
              }`}
            >
              {segment.content}
              {message.isStreaming && isLastSegment ? (
                <span aria-label="Streaming response" className="ml-1 inline-block animate-pulse">
                  ▍
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </article>
  );
}

function ToolSegmentCard({ callId }: { callId: string }) {
  const tool = useAgentStore((state) => state.toolCalls.find((call) => call.callId === callId));

  if (!tool) {
    return null;
  }

  return (
    <div className="w-full">
      <ToolCard tool={tool} />
    </div>
  );
}