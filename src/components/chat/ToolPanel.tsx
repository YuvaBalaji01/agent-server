"use client";

import { useAgentStore } from "@/src/store/agentStore";
import { ToolCard } from "./ToolCard";

export function ToolPanel() {
  const toolCalls = useAgentStore((state) => state.toolCalls);

  if (toolCalls.length === 0) {
    return null;
  }

  // Running tool always floats to the top, rest stay in most-recent-first order
  const sortedToolCalls = [...toolCalls].sort((a, b) => {
    if (a.status === "running" && b.status !== "running") return -1;
    if (b.status === "running" && a.status !== "running") return 1;
    return 0;
  });

  return (
    <section className="border-t border-slate-200 px-4 py-4 dark:border-slate-800">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-3 text-sm font-semibold text-slate-500">
          Tool Calls
        </h2>

        {/* Carousel container - vertical scroll with snap. 
            Flip to horizontal by swapping flex-col -> flex-row and overflow-y -> overflow-x */}
        <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto scroll-smooth snap-y snap-mandatory pr-1">
          {sortedToolCalls.map((tool) => (
            <div key={tool.callId} className="snap-start">
              <ToolCard tool={tool} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}