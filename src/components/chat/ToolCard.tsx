import type { ToolCallState } from "@/src/store/agentStore";

interface ToolCardProps {
  tool: ToolCallState;
}

export function ToolCard({ tool }: ToolCardProps) {
  const isRunning = tool.status === "running";

  return (
    <div
      className={`rounded-xl border p-4 ${
        isRunning
          ? "border-yellow-300 bg-slate-50 ring-2 ring-yellow-200 dark:border-yellow-700 dark:bg-slate-900 dark:ring-yellow-900"
          : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          🔧 {tool.toolName}
        </h3>

        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            tool.status === "running"
              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
              : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
          }`}
        >
          {tool.status}
        </span>
      </div>

      <div className="mt-3">
        <p className="mb-1 text-xs font-semibold text-slate-500">
          Arguments
        </p>

        <pre className="overflow-x-auto rounded bg-slate-100 p-2 text-xs dark:bg-slate-800">
          {JSON.stringify(tool.args, null, 2)}
        </pre>
      </div>

      {tool.result && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold text-slate-500">
            Result
          </p>

          <pre className="overflow-x-auto rounded bg-slate-100 p-2 text-xs dark:bg-slate-800">
            {JSON.stringify(tool.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}