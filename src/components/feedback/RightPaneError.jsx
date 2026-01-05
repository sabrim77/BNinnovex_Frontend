// path: src/components/feedback/RightPaneError.jsx
import React, { useMemo, useState } from "react";
import { API_BASE } from "../../api";
import { AlertTriangle, Copy, ExternalLink, RefreshCw } from "lucide-react";

/**
 * Right-panel error card.
 * Props:
 *  - title?: string
 *  - detail: string | Error
 *  - onRetry?: () => void
 */
export default function RightPaneError({ title = "Analysis failed", detail, onRetry }) {
  const [expanded, setExpanded] = useState(false);
  if (!detail) return null;

  // Normalize detail to string
  const text = useMemo(() => {
    if (typeof detail === "string") return detail.trim();
    if (detail?.message) return String(detail.message).trim();
    try { return JSON.stringify(detail, null, 2); } catch { return String(detail); }
  }, [detail]);

  const isLong = text.length > 320;

  const copy = async (val, label = "Copied!") => {
    try {
      await navigator.clipboard.writeText(val);
      // tiny visual feedback without toasts
      const el = document.activeElement;
      if (el && el.blur) setTimeout(() => el.blur(), 150);
    } catch {}
  };

  const healthUrl = `${API_BASE}/health`;
  const onnxUrl   = `${API_BASE}/debug/onnx`;

  return (
    <div className="card border border-rose-500/40">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-rose-300 font-semibold">
          <AlertTriangle className="h-4 w-4" />
          <span>{title}</span>
        </div>

        <div className="flex items-center gap-2">
          {onRetry && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onRetry}
              title="Retry"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => copy(text)}
            title="Copy error"
          >
            <Copy className="h-4 w-4" />
            Copy
          </button>
        </div>
      </div>

      {/* Error detail */}
      <pre
        className="text-sm opacity-90 whitespace-pre-wrap bg-slate-900/50 border border-slate-700/40 rounded-lg p-3"
        style={{
          maxHeight: expanded ? 420 : 140,
          overflow: "auto",
        }}
      >
        {isLong && !expanded ? text.slice(0, 320) + "…" : text}
      </pre>

      {isLong && (
        <div className="mt-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide details" : "Show full details"}
          </button>
        </div>
      )}

      <div className="text-xs opacity-80 mt-3 flex flex-wrap items-center gap-2">
        <span>Backend:</span>
        <code className="px-2 py-0.5 rounded-md border border-slate-600/40 bg-slate-900/40">
          {API_BASE}
        </code>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => copy(API_BASE)}
          title="Copy API base"
        >
          <Copy className="h-3 w-3" /> Copy base
        </button>

        <span className="mx-2 opacity-40">•</span>

        <a
          href={healthUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost btn-sm"
          title="Open /health in new tab"
        >
          <ExternalLink className="h-3 w-3" /> /health
        </a>

        <a
          href={onnxUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost btn-sm"
          title="Open /debug/onnx in new tab"
        >
          <ExternalLink className="h-3 w-3" /> /debug/onnx
        </a>
      </div>
    </div>
  );
}
