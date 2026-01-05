import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * Controlled toast component.
 * Props:
 *  - toast: { type: "ok"|"error", title: string, msg?: string, hint?: string }
 *  - onClose: () => void
 */
export default function Toast({ toast, onClose }) {
  if (!toast) return null;
  const kind = toast.type === "error" ? "err" : "ok";
  return (
    <div className="toast">
      <div className={`box ${kind === "err" ? "err" : "ok"}`}>
        <div className="flex items-start gap-3">
          {kind === "err" ? (
            <AlertTriangle className="h-5 w-5 text-rose-300" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
          )}
          <div className="text-sm">
            <div className="font-semibold mb-0.5">{toast.title}</div>
            {toast.msg && <div className="opacity-90">{toast.msg}</div>}
            {toast.hint && <div className="text-xs opacity-70 mt-1">{toast.hint}</div>}
          </div>
        </div>
        <div className="text-right mt-2">
          <button className="btn" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}
