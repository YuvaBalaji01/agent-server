"use client";

import { useState } from "react";
import { useAgentStore } from "@/src/store/agentStore";

export function TimelinePanel() {
  const timeline = useAgentStore((state) => state.timeline);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (timeline.length === 0) return null;

  return (
    <section className="border-b border-slate-800 p-5">
      <h2 className="mb-4 text-lg font-semibold text-white">
        TimeLine
      </h2>

      <div className="space-y-4">

        {[...timeline].reverse().map((conversation) => {

          const expanded = expandedId === conversation.id;

          return (
            <div
              key={conversation.id}
              className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800"
            >

              <button
                className="w-full p-4 text-left"
                onClick={() =>
                  setExpandedId(expanded ? null : conversation.id)
                }
              >

                <div className="flex items-center justify-between">

                  <div className="font-semibold text-white">
                    👤 {conversation.userMessage}
                  </div>

                  <div className="text-xs text-slate-500">
                    {new Date(conversation.timestamp).toLocaleTimeString()}
                  </div>

                </div>

                <div className="mt-3 flex flex-wrap gap-2">

                  <span className="rounded bg-slate-700 px-2 py-1 text-xs text-slate-300">
                    💬 {conversation.streamedTokens} Tokens
                  </span>

                  {conversation.contextUpdated && (
                    <span className="rounded bg-indigo-700 px-2 py-1 text-xs text-white">
                      📄 Context
                    </span>
                  )}

                  {conversation.finished && (
                    <span className="rounded bg-green-700 px-2 py-1 text-xs text-white">
                      ✔ Finished
                    </span>
                  )}

                  {conversation.toolCalls.length > 0 && (
                    <span className="rounded bg-orange-700 px-2 py-1 text-xs text-white">
                      🛠 {conversation.toolCalls.length} Tool
                      {conversation.toolCalls.length > 1 ? "s" : ""}
                    </span>
                  )}

                </div>

              </button>

              {expanded && (

                <div className="border-t border-slate-700 bg-slate-900 p-4">

                  {conversation.toolCalls.length > 0 && (

                    <div className="mb-4">

                      <div className="mb-2 text-sm font-semibold text-white">
                        Tool Calls
                      </div>

                      <div className="space-y-2">

                        {conversation.toolCalls.map((tool, index) => (

                          <div
                            key={index}
                            className="flex items-center justify-between rounded bg-slate-800 p-2"
                          >

                            <span className="text-sm text-slate-200">
                              {tool.name}
                            </span>

                            <span
                              className={`rounded px-2 py-1 text-xs ${
                                tool.status === "completed"
                                  ? "bg-green-700 text-white"
                                  : "bg-yellow-700 text-white"
                              }`}
                            >
                              {tool.status}
                            </span>

                          </div>

                        ))}

                      </div>

                    </div>

                  )}

                  <div className="mb-2 text-sm font-semibold text-white">
                    Assistant Response
                  </div>

                  <pre className="whitespace-pre-wrap break-words rounded-lg bg-slate-800 p-3 text-sm text-slate-200">
                    {conversation.response || "Streaming..."}
                  </pre>

                </div>

              )}

            </div>
          );
        })}

      </div>
    </section>
  );
}