// path: src/components/layout/Navbar.jsx
import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { BrainCircuit, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";

/* utils */
const cx = (...xs) => xs.filter(Boolean).join(" ");
const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

export default function Navbar({ collapsed, setCollapsed }) {
  const [dark, setDark] = useState(true);
  const nav = useNavigate();

  const themeBtnRef = useRef(null);

  // ESC key currently does nothing special (kept for future if you add things)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      // no dialogs now, so nothing to close
      if (document.activeElement === themeBtnRef.current) {
        // placeholder: you can add behavior later
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // apply theme
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/70 bg-[#020817]/95 backdrop-blur-xl shadow-[0_14px_40px_rgba(15,23,42,0.9)]">
      <div className="w-full px-3 sm:px-5 h-14 flex items-center justify-between gap-2">
        {/* LEFT: collapse toggle + brand */}
        <div className="flex items-center gap-2.5">
          {typeof setCollapsed === "function" && (
            <button
              onClick={() => setCollapsed((v) => !v)}
              className={cx(
                "inline-flex items-center justify-center h-9 w-9 rounded-full text-slate-300 hover:text-sky-50",
                "bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800/90 hover:border-sky-500/60",
                "shadow-[0_0_0_1px_rgba(15,23,42,0.9),0_10px_25px_rgba(15,23,42,0.9)]",
                focusRing
              )}
              aria-pressed={!!collapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={
                collapsed
                  ? "Expand sidebar (Ctrl/Cmd+B)"
                  : "Collapse sidebar (Ctrl/Cmd+B)"
              }
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h10M4 18h7" />
              </svg>
            </button>
          )}

          {/* Brand button */}
          <button
            onClick={() => nav("/")}
            className={cx(
              "inline-flex items-center gap-2.5 rounded-2xl px-2.5 py-1.5",
              "bg-slate-900/80 border border-slate-800/90",
              "hover:border-sky-500/70 hover:bg-slate-900",
              "shadow-[0_0_0_1px_rgba(15,23,42,0.9),0_10px_28px_rgba(15,23,42,0.9)]",
              focusRing
            )}
            aria-label="Go to Dashboard"
          >
            <div
              className="h-8 w-8 rounded-xl grid place-items-center ring-1 ring-sky-400/70 shadow-[0_0_20px_rgba(56,189,248,0.8)] bg-gradient-to-br from-sky-500 via-indigo-500 to-fuchsia-500"
              aria-hidden="true"
            >
              <BrainCircuit className="h-4 w-4 text-white" />
            </div>
            <span className="text-[13px] font-semibold tracking-[0.08em] text-slate-50 uppercase">
              UniSentiX
            </span>
          </button>
        </div>

        {/* RIGHT: only theme toggle now */}
        <div className="flex items-center gap-1.5">
          <button
            ref={themeBtnRef}
            onClick={() => setDark((d) => !d)}
            className={cx(
              "inline-flex items-center justify-center h-9 w-9 rounded-full text-slate-300 hover:text-amber-100",
              "bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800/90 hover:border-amber-400/70",
              "shadow-[0_0_0_1px_rgba(15,23,42,0.9),0_8px_22px_rgba(15,23,42,0.9)]",
              focusRing
            )}
            aria-label="Toggle theme"
            aria-pressed={dark}
            title="Toggle theme"
          >
            {dark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

Navbar.propTypes = {
  collapsed: PropTypes.bool,
  setCollapsed: PropTypes.func,
};
