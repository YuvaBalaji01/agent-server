"use client";

import { useAgentStore } from "@/src/store/agentStore";

export function TimelinePanel() {
  const timeline = useAgentStore((state) => state.timeline);

  if (timeline.length === 0) {
    return null;
  }

  return (
  <section className="border-b border-slate-800 p-5">

    <h2 className="mb-4 text-lg font-semibold text-white">
      Timeline
    </h2>

    <div className="space-y-2">

      {[...timeline].reverse().map((event) => (

        <div
          key={event.id}
          className="rounded-lg bg-slate-800 p-3"
        >

          <div className="flex items-center justify-between">

            <span className="text-sm font-medium text-slate-100">
              {event.type}
            </span>

            <span className="text-xs text-slate-500">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>

          </div>

          <p className="mt-1 text-xs text-slate-400">
            {event.summary}
          </p>

        </div>

      ))}

    </div>

  </section>
);
}