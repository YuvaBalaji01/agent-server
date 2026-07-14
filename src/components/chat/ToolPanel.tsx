"use client";

import { useAgentStore } from "@/src/store/agentStore";
import { ToolCard } from "./ToolCard";

export function ToolPanel() {
  const toolCalls = useAgentStore((state) => state.toolCalls);

  if (toolCalls.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-slate-200 px-4 py-4 dark:border-slate-800">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">
          Tool Calls
        </h2>

        <div className="space-y-3">
          {toolCalls.map((tool) => (
            <ToolCard key={tool.callId} tool={tool} />
          ))}
        </div>
      </div>
    </section>
  );
}