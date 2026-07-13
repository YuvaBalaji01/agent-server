"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";

import { wsManager } from "@/src/lib/websocket";
import type { WebSocketManager } from "@/src/lib/websocket/WebSocketManager";
import { useAgentStore } from "@/src/store/agentStore";

interface ChatInputProps {
  webSocketManager?: WebSocketManager;
}

export function ChatInput({ webSocketManager = wsManager }: ChatInputProps) {
  const [content, setContent] = useState("");
  const dispatch = useAgentStore((state) => state.dispatch);

  function sendMessage() {
    const trimmedContent = content.trim();

    if (trimmedContent.length === 0) {
      return;
    }

    dispatch({
      type: "USER_MESSAGE_SENT",
      id: crypto.randomUUID(),
      content: trimmedContent,
    });
    webSocketManager.sendUserMessage(trimmedContent);
    setContent("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex max-w-3xl items-end gap-3 rounded-2xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-slate-500 dark:border-slate-700 dark:bg-slate-900">
        <textarea
          aria-label="Message"
          className="max-h-48 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message the agent"
          rows={1}
          value={content}
        />
        <button
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          disabled={content.trim().length === 0}
          type="submit"
        >
          Send
        </button>
      </div>
    </form>
  );
}
