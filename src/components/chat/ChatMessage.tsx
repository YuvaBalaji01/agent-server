import type { ChatMessage as ChatMessageModel } from "@/src/store/agentStore";

interface ChatMessageProps {
  message: ChatMessageModel;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <article className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[75%] ${
          isUser
            ? "rounded-br-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : "rounded-bl-md bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
        }`}
      >
        {message.content}
        {message.isStreaming ? (
          <span aria-label="Streaming response" className="ml-1 inline-block animate-pulse">
            ▍
          </span>
        ) : null}
      </div>
    </article>
  );
}
