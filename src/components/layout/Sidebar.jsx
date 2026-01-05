// path: src/components/layout/Sidebar.jsx
import React from "react";
import PropTypes from "prop-types";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Radio,
  Newspaper,
  Type,
  ChevronRight,
} from "lucide-react";

/* ---------- helpers ---------- */
const cx = (...xs) => xs.filter(Boolean).join(" ");

/* ---------- styles ---------- */
const item =
  "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] \
   text-slate-100/90 hover:text-white \
   hover:bg-sky-900/60 hover:shadow-[0_0_18px_rgba(56,189,248,0.35)] \
   transition-all duration-150";

const active =
  "bg-gradient-to-r from-sky-500/70 via-violet-500/65 to-fuchsia-500/70 \
   text-white ring-1 ring-sky-300/80 shadow-[0_0_26px_rgba(168,85,247,0.6)]";

const sectionTitle =
  "px-3 text-[11px] uppercase tracking-[0.18em] text-slate-300 font-semibold";

/* ---------- Custom YouTube logo icon ---------- */
function YouTubeIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* red rounded rectangle */}
      <rect x="2" y="5" width="20" height="14" rx="4" fill="#FF0000" />
      {/* white play triangle */}
      <path d="M10 9l5 3-5 3V9z" fill="#FFFFFF" />
    </svg>
  );
}
YouTubeIcon.propTypes = {
  className: PropTypes.string,
};

/* ========================================================================== */
/*    PUBLIC WRAPPER — accepts `collapsed` and `setCollapsed`                 */
/* ========================================================================== */
export default function Sidebar({ collapsed = false, setCollapsed }) {
  return collapsed ? (
    <SidebarCollapsed setCollapsed={setCollapsed} />
  ) : (
    <SidebarExpanded setCollapsed={setCollapsed} />
  );
}

Sidebar.propTypes = {
  collapsed: PropTypes.bool,
  setCollapsed: PropTypes.func,
};

/* ========================================================================== */
/*                                COLLAPSED                                   */
/* ========================================================================== */
function SidebarCollapsed({ setCollapsed }) {
  const IconBtn =
    "w-11 h-11 grid place-items-center rounded-2xl border border-slate-700/70 \
     bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 \
     text-slate-100 hover:from-sky-950 hover:via-indigo-900 hover:to-slate-900 \
     transition shadow-[0_0_0_1px_rgba(15,23,42,0.9)]";

  return (
    <aside
      className="relative w-20 shrink-0 border-r border-slate-800/70 
                 bg-gradient-to-b from-slate-950 via-sky-950 to-slate-950 
                 backdrop-blur-xl"
    >
      <div className="flex flex-col items-center gap-4 py-4">
        {/* Brand tag */}
        <div
          className="mb-1 rounded-2xl border border-sky-500/50
                     bg-slate-950/90 px-2.5 py-1.5 text-center text-[9px]
                     uppercase tracking-[0.22em] text-sky-300"
        >
          UniSentiX
        </div>

        <NavLink to="/" end className={IconBtn}>
          <LayoutDashboard className="h-5 w-5" />
        </NavLink>

        <NavLink to="/youtube?tab=single" className={IconBtn}>
          <YouTubeIcon className="h-5 w-5" />
        </NavLink>

        <NavLink to="/live" className={IconBtn}>
          <Radio className="h-5 w-5" />
        </NavLink>

        <NavLink to="/news?tab=ingest" className={IconBtn}>
          <Newspaper className="h-5 w-5" />
        </NavLink>

        <NavLink to="/normal?tab=single" className={IconBtn}>
          <Type className="h-5 w-5" />
        </NavLink>
      </div>

      {/* floating expand button */}
      {setCollapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute -right-3 top-4 z-50 h-8 w-8 rounded-full 
                     bg-slate-900/90 border border-slate-700/70 
                     flex items-center justify-center shadow-xl rotate-180
                     hover:bg-slate-800 hover:text-white"
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </aside>
  );
}

SidebarCollapsed.propTypes = {
  setCollapsed: PropTypes.func,
};

/* ========================================================================== */
/*                                EXPANDED                                    */
/* ========================================================================== */
function SidebarExpanded({ setCollapsed }) {
  return (
    <aside
      className="relative w-72 shrink-0 border-r border-slate-800/70 
                 bg-gradient-to-b from-slate-950 via-sky-950 to-slate-950
                 backdrop-blur-xl"
    >
      <div className="flex h-full flex-col px-3 py-4">
        {/* Header: brand + collapse */}
        <div className="mb-4 flex items-center justify-between px-1">
          <div>
            <div className="text-[11px] font-semibold uppercase 
                            tracking-[0.24em] text-sky-300/90">
              UniSentix
            </div>

          </div>

          {/* collapse button (inside sidebar) */}
          {setCollapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="h-8 w-8 rounded-full border border-slate-700/70 
                         bg-slate-900/90 text-slate-200 shadow-lg 
                         hover:bg-slate-800 hover:text-white transition"
              title="Collapse sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        <div
          className="mb-4 h-px w-full 
                     bg-gradient-to-r from-transparent 
                     via-sky-700/70 to-transparent"
        />

        {/* NAV SECTIONS */}
        <nav className="flex-1 space-y-5 overflow-y-auto pb-4">
          {/* Overview */}
          <div className="space-y-1.5">
            <div className={sectionTitle}>Overview</div>

            <NavLink
              to="/"
              end
              className={({ isActive }) => cx(item, isActive && active)}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-xl 
                           border border-slate-600/70 bg-slate-950/90 
                           text-slate-50 group-hover:border-sky-300/80"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium">Dashboard</span>
            </NavLink>

            <NavLink
              to="/live"
              className={({ isActive }) => cx(item, isActive && active)}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-xl 
                           border border-slate-600/70 bg-slate-950/90 
                           text-slate-50 group-hover:border-sky-300/80"
              >
                <Radio className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium">Live News</span>
            </NavLink>
          </div>

          <div className="my-3 border-t border-slate-800/70" />

          {/* YouTube */}
          <div className="space-y-1">
            <div className={sectionTitle}>YouTube</div>

            <NavLink
              to="/youtube?tab=single"
              className={({ isActive }) => cx(item, isActive && active)}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-xl 
                           border border-slate-600/70 
                           bg-gradient-to-br from-red-500/70 
                           via-rose-500/70 to-orange-400/70"
              >
                <YouTubeIcon className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium">YouTube Analysis</span>
            </NavLink>
          </div>

          <div className="my-3 border-t border-slate-800/70" />

          {/* News (one combined entry: URLs + search) */}
          <div className="space-y-1">
            <div className={sectionTitle}>News</div>

            <NavLink
              to="/news?tab=ingest"
              className={({ isActive }) => cx(item, isActive && active)}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-xl 
                           border border-slate-600/70 
                           bg-gradient-to-br from-emerald-600/70 
                           via-sky-600/70 to-cyan-500/70"
              >
                <Newspaper className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium">News Search & URLs</span>
            </NavLink>
          </div>

          <div className="my-3 border-t border-slate-800/70" />

          {/* Text / Normal Analysis */}
          <div className="space-y-1">
            <div className={sectionTitle}>Text</div>

            <NavLink
              to="/normal?tab=single"
              className={({ isActive }) => cx(item, isActive && active)}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-xl 
                           border border-slate-600/70 
                           bg-gradient-to-br from-indigo-600/70 
                           via-sky-600/70 to-cyan-500/70"
              >
                <Type className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium">Text Sentiment</span>
            </NavLink>
          </div>
        </nav>

        {/* Footer pill */}
        <div className="mt-2 border-t border-slate-800/70 pt-2 text-[11px] text-slate-300/90">

        </div>
      </div>
    </aside>
  );
}

SidebarExpanded.propTypes = {
  setCollapsed: PropTypes.func,
};
