"use client";

import { useAgentStore } from "@/src/store/agentStore";

export function ContextInspector() {
  const context = useAgentStore((state) => state.contextSnapshot);

  if (!context) {
    return null;
  }

  return (
    <section className="border-t border-slate-200 px-4 py-4 dark:border-slate-800">
      <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="mb-3 text-lg font-semibold">
          🧠 Context Inspector
        </h2>

        <div className="mb-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Context ID
          </span>

          <p className="mt-1 font-mono text-sm">
            {context.contextId}
          </p>
        </div>

        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Snapshot
          </span>

          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs dark:bg-slate-800">
            {JSON.stringify(context.data, null, 2)}
          </pre>
        </div>
      </div>
    </section>
  );
}