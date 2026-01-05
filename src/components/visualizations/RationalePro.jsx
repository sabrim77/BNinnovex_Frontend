// path: src/components/visualizations/RationalePro.jsx
import React from "react";

export default function RationalePro({ text, model = "—", loading = false }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm opacity-70">Rationale</div>
        <span className="badge text-xs">LLM: {model}</span>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-3 rounded bg-slate-700/40 w-11/12" />
          <div className="h-3 rounded bg-slate-700/40 w-9/12" />
        </div>
      ) : (
        <div className="mt-1 italic leading-relaxed">
          {text || "—"}
        </div>
      )}
    </div>
  );
}
