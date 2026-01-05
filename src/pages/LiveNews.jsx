// path: src/pages/LiveNews.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";

import Navbar from "../components/layout/Navbar.jsx";
import Sidebar from "../components/layout/Sidebar.jsx";
import ErrorBoundary from "../components/dev/ErrorBoundary.jsx";
import { API_BASE } from "../api.js";

import {
  RefreshCcw,
  AlertCircle,
  ExternalLink,
  Radio,
  Sparkles,
  Database,
  Filter,
  Activity,
  Globe,
  Hash,
  Clock,
} from "lucide-react";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Tooltip,
  Legend,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const cx = (...xs) => xs.filter(Boolean).join(" ");

const COLORS = ["#38bdf8", "#a78bfa", "#0AFF9D", "#FFD447", "#FF3366", "#7A89A1"];

/* ----------------------------- helpers ----------------------------- */

const niceTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

const relativeTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const now = Date.now();
  const diff = now - d.getTime();
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const day = Math.floor(h / 24);

  if (s < 30) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (day < 7) return `${day}d ago`;

  return d.toLocaleDateString();
};

function safeNum(x, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function labelNorm(lab) {
  const s = String(lab || "neutral").toLowerCase();
  if (s === "positive" || s === "negative" || s === "neutral") return s;
  return "neutral";
}

function labToBadge(lab) {
  return lab === "positive"
    ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/40"
    : lab === "negative"
    ? "bg-rose-500/10 text-rose-200 border-rose-500/40"
    : "bg-slate-500/10 text-slate-200 border-slate-500/40";
}

function clampText(s, n = 420) {
  const t = (s || "").trim();
  if (!t) return "";
  if (t.length <= n) return t;
  return t.slice(0, n - 3).trimEnd() + "...";
}

function hostFromUrl(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

/**
 * Score extractor:
 * If your backend has score, it will show.
 * If not, visuals still work (score defaults to 0).
 */
function getScore(it) {
  return safeNum(
    it?.score ??
      it?.sentiment_score ??
      it?.sentiment?.score ??
      it?.sentiment?.value ??
      0,
    0
  );
}

/* ----------------------------- controls config ----------------------------- */

const PRESET_WINDOWS = [
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "6 hours", minutes: 360 },
  { label: "24 hours", minutes: 1440 },
  { label: "7 days", minutes: 10080 },
  { label: "1 month", minutes: 43200 },
  { label: "1 year", minutes: 525600 },
];

const REFRESH_OPTIONS = [
  { label: "15s", ms: 15000 },
  { label: "30s", ms: 30000 },
  { label: "60s", ms: 60000 },
];

const MAX_WINDOW_MINUTES = 365 * 24 * 60;

const formatWindow = (m) => {
  if (!m) return "—";
  if (m < 60) return `${m} min`;
  const h = m / 60;
  if (h < 24) return `${h.toFixed(h % 1 === 0 ? 0 : 1)} hours`;
  const d = m / (60 * 24);
  if (d < 30) return `${d.toFixed(d % 1 === 0 ? 0 : 1)} days`;
  const mon = d / 30;
  if (mon < 12) return `${mon.toFixed(mon % 1 === 0 ? 0 : 1)} months`;
  const y = d / 365;
  return `${y.toFixed(y % 1 === 0 ? 0 : 1)} years`;
};

/* ----------------------------- small UI components ----------------------------- */

function NeonPanel({ title, subtitle, badge, children }) {
  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-950/60 backdrop-blur p-4 shadow-[0_18px_45px_rgba(15,23,42,0.85)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {subtitle ? <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p> : null}
        </div>
        {badge ? (
          <div className="text-[11px] text-slate-200 border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 rounded-full">
            {badge}
          </div>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function NeonKPI({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.75)]">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-slate-400">{label}</div>
        {Icon ? <Icon className="h-4 w-4 text-cyan-300" /> : null}
      </div>
      <div className="mt-2 text-xl font-semibold text-slate-100">{value}</div>
      <div className="mt-2 h-[2px] rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 opacity-30" />
    </div>
  );
}

function MiniVizCard({ title, icon: Icon, children }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/55 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="inline-flex items-center gap-2">
          {Icon ? <Icon className="h-4 w-4 text-cyan-300" /> : null}
          <span className="text-[12px] font-semibold text-slate-100">{title}</span>
        </div>
      </div>
      <div className="h-[180px]">{children}</div>
    </div>
  );
}

function EmptyVizText() {
  return <div className="h-full grid place-items-center text-[12px] text-slate-500">No data</div>;
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="h-3 w-24 bg-slate-800/70 rounded mb-3" />
          <div className="h-4 w-4/5 bg-slate-800/70 rounded mb-2" />
          <div className="h-4 w-3/5 bg-slate-800/70 rounded" />
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- Page ----------------------------- */

export default function LiveNews() {
  const [collapsed, setCollapsed] = useState(false);

  // auto refresh
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshMs, setRefreshMs] = useState(15000);

  // window
  const [windowMinutes, setWindowMinutes] = useState(30);

  // data
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  // ✅ SAME API as your current page
  const fetchSnapshot = useCallback(
    async ({ silent = false, windowOverride } = {}) => {
      if (!silent) setLoading(true);
      setErr("");

      try {
        const minutes = windowOverride ?? windowMinutes;

        const res = await fetch(`${API_BASE}/stream/news/live`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            window_minutes: minutes,
            limit: 50,
          }),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || `HTTP ${res.status}`);
        }

        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
        setLastUpdated(new Date().toISOString());
      } catch (e) {
        setErr(e?.message || "Failed to load live news");
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [windowMinutes]
  );

  useEffect(() => {
    fetchSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => fetchSnapshot({ silent: true }), refreshMs);
    return () => clearInterval(id);
  }, [autoRefresh, refreshMs, fetchSnapshot]);

  const handlePresetClick = (minutes) => {
    setWindowMinutes(minutes);
    fetchSnapshot({ windowOverride: minutes });
  };

  const handleWindowInputChange = (e) => {
    const raw = Number(e.target.value) || 30;
    const clamped = Math.max(5, Math.min(MAX_WINDOW_MINUTES, raw));
    setWindowMinutes(clamped);
  };

  const refreshLabel =
    REFRESH_OPTIONS.find((o) => o.ms === refreshMs)?.label || `${refreshMs / 1000}s`;

  /* ----------------------------- KPIs ----------------------------- */

  const sentimentCounts = useMemo(() => {
    const acc = { positive: 0, negative: 0, neutral: 0 };
    for (const it of items) {
      const lab = labelNorm(it?.sentiment ?? it?.sentiment?.label);
      acc[lab] += 1;
    }
    return acc;
  }, [items]);

  const avgScore = useMemo(() => {
    if (!items.length) return 0;
    const s = items.reduce((acc, it) => acc + getScore(it), 0);
    return s / items.length;
  }, [items]);

  // if you don't have AI enrichment in /live, this stays 0 and still looks fine
  const aiCount = useMemo(() => items.filter((x) => !!x?.ai).length, [items]);
  const aiPct = useMemo(
    () => (items.length ? Math.round((aiCount / items.length) * 100) : 0),
    [aiCount, items.length]
  );

  /* ----------------------------- Visualizations ----------------------------- */

  // Donut: positive/negative/neutral
  const sentimentDonut = useMemo(
    () => [
      { name: "Positive", value: sentimentCounts.positive },
      { name: "Negative", value: sentimentCounts.negative },
      { name: "Neutral", value: sentimentCounts.neutral },
    ],
    [sentimentCounts]
  );

  // score histogram
  const scoreHistogram = useMemo(() => {
    const edges = [-1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1.0001];
    const labels = [];
    for (let i = 0; i < edges.length - 1; i++) {
      labels.push(`${edges[i].toFixed(1)}..${(edges[i + 1] - 0.0001).toFixed(1)}`);
    }
    const counts = new Array(labels.length).fill(0);

    for (const it of items) {
      const s = Math.max(-1, Math.min(1, getScore(it)));
      let idx = 0;
      for (let i = 0; i < edges.length - 1; i++) {
        if (s >= edges[i] && s < edges[i + 1]) {
          idx = i;
          break;
        }
      }
      counts[idx] += 1;
    }
    return labels.map((bucket, i) => ({ bucket, count: counts[i] }));
  }, [items]);

  // avg score by source (top 8 by volume)
  const avgBySource = useMemo(() => {
    const m = new Map();
    for (const it of items) {
      const src = (it?.source || "Unknown").trim() || "Unknown";
      const sc = getScore(it);
      const cur = m.get(src) || { source: src, sum: 0, n: 0 };
      cur.sum += sc;
      cur.n += 1;
      m.set(src, cur);
    }
    return Array.from(m.values())
      .map((x) => ({ source: x.source, avg: x.n ? x.sum / x.n : 0, n: x.n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8);
  }, [items]);

  // domains from URLs
  const topDomains = useMemo(() => {
    const m = new Map();
    for (const it of items) {
      const h = hostFromUrl(it?.url);
      m.set(h, (m.get(h) || 0) + 1);
    }
    return Array.from(m.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [items]);

  // keywords from titles
  const topKeywords = useMemo(() => {
    const stop = new Set([
      "the","a","an","and","or","to","of","in","on","for","with","from","by","as","at",
      "is","are","was","were","this","that","these","those","it","its","be","been","being",
      "into","over","under","after","before","about","more","new","latest","breaking","update","today",
    ]);

    const freq = new Map();
    for (const it of items) {
      const title = String(it?.title || "").toLowerCase();
      const tokens = title
        .split(/[^a-z0-9\u0980-\u09ff]+/g)
        .map((t) => t.trim())
        .filter(Boolean);

      for (const w of tokens) {
        if (w.length < 3) continue;
        if (stop.has(w)) continue;
        freq.set(w, (freq.get(w) || 0) + 1);
      }
    }

    return Array.from(freq.entries())
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [items]);

  // recency buckets
  const recencyBuckets = useMemo(() => {
    const now = Date.now();
    const bins = [
      { bucket: "< 1h", count: 0 },
      { bucket: "1–6h", count: 0 },
      { bucket: "6–24h", count: 0 },
      { bucket: "1–3d", count: 0 },
      { bucket: "3–7d", count: 0 },
      { bucket: "> 7d / unknown", count: 0 },
    ];

    for (const it of items) {
      const dt = it?.published_at ? new Date(it.published_at) : null;
      if (!dt || Number.isNaN(dt.getTime())) {
        bins[5].count += 1;
        continue;
      }
      const hours = (now - dt.getTime()) / 36e5;
      if (hours < 1) bins[0].count += 1;
      else if (hours < 6) bins[1].count += 1;
      else if (hours < 24) bins[2].count += 1;
      else if (hours < 72) bins[3].count += 1;
      else if (hours < 168) bins[4].count += 1;
      else bins[5].count += 1;
    }

    return bins;
  }, [items]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0b1220] text-slate-100 isolate">
      <Navbar collapsed={collapsed} setCollapsed={setCollapsed} />

      <div
        className={cx(
          "grid h-[calc(100vh-56px)] transition-[grid-template-columns] duration-200",
          collapsed ? "grid-cols-[80px_1fr]" : "grid-cols-[280px_1fr]"
        )}
      >
        <aside className="h-full min-w-0 border-r border-slate-800/60 bg-slate-950/40 backdrop-blur">
          <ErrorBoundary>
            <Sidebar collapsed={collapsed} />
          </ErrorBoundary>
        </aside>

        <main className="relative h-full min-h-0 overflow-y-auto px-4 md:px-8 py-8">
          <div className="relative z-10">
            {/* HEADER */}
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-cyan-300 tracking-tight drop-shadow-[0_0_10px_rgba(0,255,255,0.35)]">
                  Live News Stream
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Snapshot sentiment + analytics computed from{" "}
                  <span className="text-slate-200">/stream/news/live</span>.
                </p>

                {lastUpdated && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Updated: <span className="text-slate-200">{niceTime(lastUpdated)}</span> •{" "}
                    <span className="text-slate-200">{relativeTime(lastUpdated)}</span> • Window:{" "}
                    <span className="text-slate-200">{formatWindow(windowMinutes)}</span>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 justify-end">
                <div
                  className={cx(
                    "px-3 py-1 rounded-full text-xs font-medium border",
                    err
                      ? "border-rose-500/40 text-rose-300 bg-rose-500/10"
                      : "border-emerald-500/30 text-emerald-300 bg-emerald-500/10"
                  )}
                >
                  {err ? "System Issues" : "System Stable"}
                </div>

                <button
                  onClick={() => fetchSnapshot()}
                  disabled={loading}
                  className={cx(
                    "inline-flex items-center gap-2 rounded-full border border-cyan-500/40 px-3 py-1.5 text-xs font-medium text-cyan-200",
                    "hover:bg-cyan-500/10 hover:shadow-[0_0_10px_rgba(34,211,238,0.4)] transition",
                    loading && "opacity-70 cursor-not-allowed"
                  )}
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-cyan-300 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                  <RefreshCcw className={cx("h-4 w-4", loading && "animate-spin")} />
                  Refresh
                </button>
              </div>
            </header>

            {/* HOLO LINE */}
            <div className="w-full h-[2px] bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 opacity-30 rounded-full mb-4" />

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 mb-4">
              <NeonKPI icon={Radio} label="Items" value={items.length} />
              <NeonKPI icon={Sparkles} label="AI enriched" value={`${aiPct}%`} />
              <NeonKPI label="Positive" value={sentimentCounts.positive} />
              <NeonKPI label="Negative" value={sentimentCounts.negative} />
              <NeonKPI label="Neutral" value={sentimentCounts.neutral} />
              <NeonKPI icon={Database} label="Avg score" value={avgScore.toFixed(3)} />
            </div>

            {/* CONTROLS */}
            <NeonPanel
              title="Controls"
              subtitle="Time window + auto-refresh + quick ranges"
              badge={
                <span className="inline-flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5" />
                  Stream
                </span>
              }
            >
              <div className="grid gap-3 md:grid-cols-12 items-end">
                {/* Auto refresh toggle */}
                <label className="md:col-span-3 flex items-center gap-2 text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                  auto refresh{" "}
                  <span className="text-slate-500">({autoRefresh ? refreshLabel : "off"})</span>
                </label>

                {/* Refresh interval */}
                <div className="md:col-span-4">
                  <div className="text-[11px] text-slate-400 mb-1">Refresh interval</div>
                  <div className="inline-flex rounded-full bg-slate-950/50 border border-slate-800 p-0.5">
                    {REFRESH_OPTIONS.map((opt) => {
                      const active = refreshMs === opt.ms;
                      return (
                        <button
                          key={opt.ms}
                          type="button"
                          disabled={!autoRefresh}
                          onClick={() => setRefreshMs(opt.ms)}
                          className={cx(
                            "px-2.5 py-1 rounded-full text-[11px] transition",
                            active
                              ? "bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-[0_0_18px_rgba(56,189,248,0.55)]"
                              : "text-slate-300 hover:bg-slate-800/70",
                            !autoRefresh && "opacity-40 cursor-not-allowed"
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Window minutes */}
                <div className="md:col-span-5">
                  <div className="text-[11px] text-slate-400 mb-1">Time window (minutes)</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={5}
                      max={MAX_WINDOW_MINUTES}
                      value={windowMinutes}
                      onChange={handleWindowInputChange}
                      onBlur={() => fetchSnapshot()}
                      className="w-28 rounded-lg bg-slate-950/50 border border-slate-800 px-3 py-2 text-xs text-slate-100"
                    />
                    <span className="text-[11px] text-slate-500">= {formatWindow(windowMinutes)}</span>
                  </div>
                </div>

                {/* Quick ranges */}
                <div className="md:col-span-12 pt-2 border-t border-slate-800/80">
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_WINDOWS.map((p) => {
                      const active = windowMinutes === p.minutes;
                      return (
                        <button
                          key={p.minutes}
                          type="button"
                          onClick={() => handlePresetClick(p.minutes)}
                          className={cx(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] border transition",
                            active
                              ? "border-cyan-400/80 bg-gradient-to-r from-cyan-600 to-indigo-600 text-cyan-50 shadow-[0_0_18px_rgba(56,189,248,0.6)]"
                              : "border-slate-700/80 bg-slate-950/40 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-100"
                          )}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {err && (
                  <div className="md:col-span-12 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-red-100">
                    <AlertCircle className="h-4 w-4 mt-[2px]" />
                    <div className="text-xs break-words">{err}</div>
                  </div>
                )}
              </div>
            </NeonPanel>

            {/* MAIN GRID */}
            <div className="mt-5 grid grid-cols-1 xl:grid-cols-[520px_minmax(0,1fr)] gap-5 items-start">
              {/* LEFT: LIST */}
              <NeonPanel
                title="Latest Items"
                subtitle="Newest items appear at the top"
                badge={`${items.length} items`}
              >
                {loading ? (
                  <ListSkeleton />
                ) : items.length === 0 ? (
                  <div className="text-sm text-slate-400">No items returned for current window.</div>
                ) : (
                  <div className="space-y-3 max-h-[72vh] overflow-y-auto pr-2">
                    {items.map((it, idx) => {
                      const lab = labelNorm(it?.sentiment ?? it?.sentiment?.label);
                      const score = getScore(it);
                      const rel = relativeTime(it?.published_at);
                      const abs = niceTime(it?.published_at);

                      return (
                        <article
                          key={it?.url || `${idx}-${it?.title || "item"}`}
                          className="group border border-slate-800 rounded-xl p-4 bg-slate-950/70 hover:bg-slate-900 hover:border-cyan-500/40 hover:shadow-[0_0_15px_rgba(34,211,238,0.25)] transition relative"
                        >
                          <div className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-cyan-400 to-blue-500 opacity-80 rounded-l-xl" />

                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cx("rounded-full border px-2 py-0.5 text-[11px]", labToBadge(lab))}>
                              {lab}
                            </span>

                            <span className="text-[11px] text-slate-400">
                              score: <span className="text-slate-200">{score.toFixed(3)}</span>
                            </span>

                            {it?.source && <span className="text-[11px] text-slate-500">{it.source}</span>}

                            {it?.published_at && (
                              <span className="text-[11px] text-slate-500">
                                • <time title={abs}>{rel}</time>
                              </span>
                            )}
                          </div>

                          <h3 className="mt-2 text-sm font-semibold text-slate-100 group-hover:text-cyan-300 transition break-words">
                            {it?.title || "Untitled"}
                          </h3>

                          {it?.summary && (
                            <p className="mt-1 text-xs text-slate-300 line-clamp-2">
                              {clampText(it.summary, 240)}
                            </p>
                          )}

                          <div className="mt-3 flex justify-end">
                            {it?.url ? (
                              <a
                                href={it.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900 hover:border-slate-700"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Open
                              </a>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </NeonPanel>

              {/* RIGHT: VISUALS */}
              <NeonPanel
                title="Live Visualizations"
                subtitle="Charts computed from the current snapshot results"
                badge="Analytics"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 auto-rows-[220px]">
                  <MiniVizCard title="Sentiment split" icon={Radio}>
                    {items.length === 0 ? (
                      <EmptyVizText />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={sentimentDonut} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={80} label>
                            <Cell fill="#22c55e" />
                            <Cell fill="#fb7185" />
                            <Cell fill="#9ca3af" />
                          </Pie>
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: "0.75rem", color: "#9ca3af" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </MiniVizCard>

                  <MiniVizCard title="Sentiment score distribution" icon={Activity}>
                    {items.length === 0 ? (
                      <EmptyVizText />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={scoreHistogram}>
                          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                          <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: "#9ca3af" }} interval={1} />
                          <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill={COLORS[1]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </MiniVizCard>

                  <MiniVizCard title="Avg sentiment by source (Top 8)" icon={Radio}>
                    {avgBySource.length === 0 ? (
                      <EmptyVizText />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={avgBySource} layout="vertical" margin={{ left: 18 }}>
                          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                          <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                          <YAxis
                            type="category"
                            dataKey="source"
                            tick={{ fontSize: 9, fill: "#9ca3af" }}
                            width={90}
                          />
                          <Tooltip />
                          <Bar dataKey="avg" fill={COLORS[0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </MiniVizCard>

                  <MiniVizCard title="Recency buckets" icon={Clock}>
                    {items.length === 0 ? (
                      <EmptyVizText />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={recencyBuckets}>
                          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                          <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                          <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" fill={COLORS[2]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </MiniVizCard>

                  <MiniVizCard title="Top domains" icon={Globe}>
                    {topDomains.length === 0 ? (
                      <EmptyVizText />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topDomains} layout="vertical" margin={{ left: 18 }}>
                          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                          <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                          <YAxis type="category" dataKey="domain" tick={{ fontSize: 9, fill: "#9ca3af" }} width={110} />
                          <Tooltip />
                          <Bar dataKey="count" fill={COLORS[3]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </MiniVizCard>

                  <MiniVizCard title="Top keywords (title)" icon={Hash}>
                    {topKeywords.length === 0 ? (
                      <EmptyVizText />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topKeywords} layout="vertical" margin={{ left: 18 }}>
                          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                          <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} />
                          <YAxis type="category" dataKey="word" tick={{ fontSize: 9, fill: "#9ca3af" }} width={95} />
                          <Tooltip />
                          <Bar dataKey="count" fill={COLORS[4]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </MiniVizCard>
                </div>
              </NeonPanel>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
