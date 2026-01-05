import React from "react";
import { Loader2 } from "lucide-react";

/** Small inline spinner with optional label */
export default function Spinner({ label = "Working…" }) {
  return (
    <div className="flex items-center gap-2 text-sm opacity-80">
      <Loader2 className="animate-spin h-4 w-4" />
      {label}
    </div>
  );
}
