"use client";

import { ChatPanel } from "@/src/components/chat";
import { useAgentClient } from "@/src/hooks/useAgentClient";

export default function Home() {
  useAgentClient();

  return (
    <main className="h-full min-h-0 flex-1 bg-slate-50 dark:bg-slate-950">
      <ChatPanel />
    </main>
  );
}
