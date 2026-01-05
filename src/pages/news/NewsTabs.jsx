// path: src/pages/news/NewsTabs.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Newspaper, Rss, Link as LinkIcon } from "lucide-react";

import Navbar from "../../components/layout/Navbar.jsx";
import Sidebar from "../../components/layout/Sidebar.jsx";
import ErrorBoundary from "../../components/dev/ErrorBoundary.jsx";

import NewsIngest from "./NewsIngest.jsx";
import NewsManual from "./NewsManual.jsx";

/* --------------------------------- Helpers --------------------------------- */

const cx = (...x) => x.filter(Boolean).join(" ");

// Only two tabs now: ingest + manual
const TABS = [
  { key: "ingest", label: "News Search", icon: Rss },
  { key: "manual", label: "Single Article Search", icon: LinkIcon },
];

const TAB_META = {
  ingest: {
    sectionTitle: "News Search",
    sectionSubtitle:
      "Search and ingest multiple news articles via RSS feeds filtered by keywords.",
  },
  manual: {
    sectionTitle: "Single Article Search",
    sectionSubtitle:
      "Analyze one specific news URL with detailed sentiment and narrative.",
  },
};

const getTabFromSearch = (loc) => {
  const params = new URLSearchParams(loc.search || "");
  const t = params.get("tab");
  if (!t) return "ingest";
  const keys = TABS.map((tab) => tab.key);
  return keys.includes(t) ? t : "ingest";
};

/* --------------------------- Shared Layout Shell --------------------------- */

const STORAGE_KEY = "railCollapsed";

function PageShell({ children }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "false");
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
    } catch {}
  }, [collapsed]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0b1220] text-slate-100 isolate">
      <Navbar collapsed={collapsed} setCollapsed={setCollapsed} />

      <div
        className={cx(
          "grid h-[calc(100vh-56px)] transition-[grid-template-columns] duration-200",
          collapsed ? "grid-cols-[80px_1fr]" : "grid-cols-[280px_1fr]",
        )}
      >
        <aside
          className="h-full min-w-0 border-r border-slate-800/60 bg-slate-950/40 backdrop-blur"
          aria-label="Primary navigation"
          role="region"
        >
          <ErrorBoundary>
            <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
          </ErrorBoundary>
        </aside>

        <main className="relative h-full min-h-0 overflow-y-auto px-4 md:px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/* --------------------------------- Component -------------------------------- */

export default function NewsTabs() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = useMemo(() => getTabFromSearch(location), [location]);
  const activeMeta = TAB_META[activeTab] || TAB_META.ingest;

  const setTab = (key) => {
    const params = new URLSearchParams(location.search || "");
    params.set("tab", key);
    navigate(
      { pathname: "/news", search: params.toString() },
      { replace: false },
    );
  };

  const renderCurrent = () => {
    switch (activeTab) {
      case "manual":
        return <NewsManual />;
      case "ingest":
      default:
        return <NewsIngest />;
    }
  };

  return (
    <PageShell>
      <ErrorBoundary>
        <div className="mx-auto w-full max-w-[1600px]">
          {/* Page heading: News Analysis */}
          <header className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300 shadow-[0_0_0_1px_rgba(37,99,235,0.35)]">
                <Newspaper className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-semibold tracking-tight">
                  News Analysis
                </h1>
                <p className="text-[11px] md:text-xs text-slate-400 mt-0.5">
                  Run sentiment analysis on news, either via RSS search or a
                  single article URL.
                </p>
              </div>
            </div>

            {/* Active tab badge */}
            <div className="hidden md:flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-[11px] text-slate-300">
              <span className="uppercase tracking-[0.16em] text-slate-500">
                ACTIVE
              </span>
              <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-medium">{activeMeta.sectionTitle}</span>
            </div>
          </header>

          {/* Tab Switcher */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {TABS.map(({ key, label, icon: Icon }) => {
              const isActive = key === activeTab;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                    isActive
                      ? "border-blue-500/70 bg-blue-500/15 text-blue-100 shadow-[0_0_0_1px_rgba(59,130,246,0.45)]"
                      : "border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-900 hover:border-slate-700",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Section heading that changes per tab */}
          <div className="mb-3">
            <h2 className="text-sm md:text-[15px] font-semibold text-slate-100">
              {activeMeta.sectionTitle}
            </h2>
            <p className="text-[11px] md:text-xs text-slate-400 mt-0.5">
              {activeMeta.sectionSubtitle}
            </p>
          </div>

          {/* Content */}
          <section className="rounded-2xl border border-slate-800/70 bg-slate-900/60 p-3 md:p-4">
            {renderCurrent()}
          </section>
        </div>
      </ErrorBoundary>
    </PageShell>
  );
}
