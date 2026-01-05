// path: src/pages/news/NewsIngest.jsx
import React, { useMemo, useState, useEffect } from "react";
import {
  RefreshCcw,
  Play,
  AlertCircle,
  BarChart2,
  MapPin,
  Globe,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  Download,
  Filter,
  X,
  Search,
  Plus,
  Layers,
} from "lucide-react";
import { API_BASE } from "../../api.js";

/* ---------- presets (UPDATED: More Bangla sources) ----------
   Notes:
   - Keep RSS URLs as best-effort. If a site changes RSS endpoint later, the UI still supports "Custom RSS URL".
*/
const PRESETS = [
  // --- Bangla (BD) ---
  { name: "প্রথম আলো (Bangla)", rss: "https://www.prothomalo.com/feed", tag: "BD • Bangla" },
  { name: "ইত্তেফাক", rss: "https://www.ittefaq.com.bd/rss", tag: "BD • Bangla" },
  { name: "কালের কণ্ঠ", rss: "https://www.kalerkantho.com/rss.xml", tag: "BD • Bangla" },
  { name: "যুগান্তর", rss: "https://www.jugantor.com/rss.xml", tag: "BD • Bangla" },
  { name: "সমকাল", rss: "https://www.samakal.com/rss", tag: "BD • Bangla" },
  { name: "জনকণ্ঠ", rss: "https://www.dailyjanakantha.com/rss", tag: "BD • Bangla" },
  { name: "বাংলা ট্রিবিউন", rss: "https://www.banglatribune.com/feed", tag: "BD • Bangla" },
  { name: "bdnews24 (Bangla-ish)", rss: "https://bdnews24.com/feed/", tag: "BD • Mixed" },

  // --- International Bangla ---
  { name: "BBC বাংলা", rss: "https://feeds.bbci.co.uk/bengali/rss.xml", tag: "INT • Bangla" },

  // --- English / Mixed (Optional, useful for comparison) ---
  { name: "The Daily Star", rss: "https://www.thedailystar.net/rss.xml", tag: "BD • English" },
  { name: "Prothom Alo (English)", rss: "https://en.prothomalo.com/feed", tag: "BD • English" },
];

/* ---------- tiny helpers ---------- */
const clampTxt = (s, n = 220) => (!s ? "" : s.length > n ? s.slice(0, n) + "…" : s);
const pct = (v) => `${Math.round(Number(v || 0) * 100)}%`;
const niceDate = (d) => (d ? new Date(d).toLocaleString() : "—");

const timeAgo = (d) => {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  const sec = Math.max(1, Math.round(ms / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
};

const fmtTime = (sec) => {
  if (!sec && sec !== 0) return "00:00";
  const s = String(sec % 60).padStart(2, "0");
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  return `${m}:${s}`;
};

const domainOf = (u) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "";
  }
};

const faviconOf = (u) => {
  const d = domainOf(u);
  return d
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`
    : "";
};

/* Tailwind version of sentiment pill */
const labToClass = (lab) =>
  lab === "positive"
    ? "inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
    : lab === "negative"
    ? "inline-flex items-center gap-1 rounded-full border border-rose-500/60 bg-rose-500/15 px-2 py-0.5 text-[11px] text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.25)]"
    : "inline-flex items-center gap-1 rounded-full border border-slate-500/70 bg-slate-800/70 px-2 py-0.5 text-[11px] text-slate-200";

const Busy = ({ text = "Working…" }) => (
  <div className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-slate-950/80 px-3 py-2 text-slate-100 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
    <RefreshCcw className="h-4 w-4 animate-spin text-sky-300" />
    <span className="text-xs">{text}</span>
  </div>
);

const ErrorNote = ({ msg }) => (
  <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-950/70 p-3 text-red-100 shadow-[0_16px_40px_rgba(127,29,29,0.7)]">
    <AlertCircle className="h-4 w-4 mt-[2px]" />
    <div className="text-sm leading-relaxed">{msg}</div>
  </div>
);

function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-gradient-to-r from-slate-800/80 via-slate-900/80 to-slate-800/80 ${className}`}
    />
  );
}

async function safePOST(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    const e = new Error(`HTTP ${r.status} ${r.statusText} — ${t || url}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

/* ---------- CSV exporter ---------- */
function toCSV(items) {
  if (!items?.length) return "";
  const cols = ["title", "url", "site", "source", "published_at", "label", "confidence", "narrative"];
  const esc = (s) => {
    if (s == null) return "";
    const str = String(s).replace(/\r?\n|\r/g, " ");
    return /[",]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const header = cols.join(",");
  const rows = items.map((it) => cols.map((c) => esc(it[c])).join(","));
  return [header, ...rows].join("\n");
}

/* ---------- constants ---------- */
const MODEL_ID = "onnx-optimized";

const FILTER_STYLES = {
  all: "border-slate-300 text-slate-100 bg-slate-900",
  positive: "border-emerald-400 text-emerald-100 bg-emerald-500/10",
  neutral: "border-slate-500 text-slate-100 bg-slate-700/40",
  negative: "border-rose-400 text-rose-100 bg-rose-500/10",
};

/* ---------- main component ---------- */
export default function NewsIngest() {
  // sources (default select: a few Bangla)
  const [feeds, setFeeds] = useState([
    "https://feeds.bbci.co.uk/bengali/rss.xml",
    "https://www.prothomalo.com/feed",
    "https://www.kalerkantho.com/rss.xml",
  ]);

  // advanced settings
  const [limit, setLimit] = useState(5); // limit_per_feed (backend)
  const [timeRange, setTimeRange] = useState("24h"); // UI-only right now
  const [wantNarr, setWantNarr] = useState(false);

  // keywords
  const [keywords, setKeywords] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");

  // ingest request / result
  const [loading, setLoading] = useState(false);
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null); // {model_used, items[], summary{}}

  // result filters
  const [sentimentFilter, setSentimentFilter] = useState("all"); // all | positive | neutral | negative
  const [sortBy, setSortBy] = useState("published_desc"); // published_desc | conf_desc | conf_asc

  // deep analysis modal state
  const [activeDeepItem, setActiveDeepItem] = useState(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepErr, setDeepErr] = useState("");
  const [deepResult, setDeepResult] = useState(null);

  // NEW: preset search + custom RSS add
  const [presetSearch, setPresetSearch] = useState("");
  const [customRssName, setCustomRssName] = useState("");
  const [customRssUrl, setCustomRssUrl] = useState("");

  /* ---------- loading timer (ingest) ---------- */
  useEffect(() => {
    if (!loading) {
      setLoadingElapsed(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => {
      const sec = Math.floor((Date.now() - started) / 1000);
      setLoadingElapsed(sec);
    }, 500);
    return () => clearInterval(id);
  }, [loading]);

  /* ---------- keyword handlers ---------- */
  function addKeyword() {
    const raw = keywordInput.trim();
    if (!raw) return;

    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    if (!parts.length) return;

    setKeywords((prev) => {
      const existing = new Set(prev);
      const next = [...prev];
      for (const p of parts) {
        const k = p.toLowerCase();
        if (!existing.has(k)) {
          existing.add(k);
          next.push(k);
        }
      }
      return next;
    });

    setKeywordInput("");
  }

  function removeKeyword(k) {
    setKeywords((prev) => prev.filter((x) => x !== k));
  }

  function handleKeywordKey(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword();
    }
  }

  /* ---------- source handlers ---------- */
  function toggleFeed(u) {
    setFeeds((prev) => (prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]));
  }

  function selectAllFilteredPresets(presets) {
    const urls = presets.map((p) => p.rss);
    setFeeds((prev) => {
      const s = new Set(prev);
      urls.forEach((u) => s.add(u));
      return Array.from(s);
    });
  }

  function clearAllFeeds() {
    setFeeds([]);
  }

  function removeFeed(u) {
    setFeeds((prev) => prev.filter((x) => x !== u));
  }

  function addCustomFeed() {
    const url = customRssUrl.trim();
    if (!url) return;
    // minimal validation
    if (!/^https?:\/\//i.test(url)) {
      setErr("Custom RSS must start with http:// or https://");
      return;
    }
    setErr("");
    setFeeds((prev) => (prev.includes(url) ? prev : [...prev, url]));
    setCustomRssName("");
    setCustomRssUrl("");
  }

  const filteredPresets = useMemo(() => {
    const q = presetSearch.trim().toLowerCase();
    if (!q) return PRESETS;
    return PRESETS.filter((p) => {
      const hay = `${p.name} ${p.tag || ""} ${p.rss}`.toLowerCase();
      return hay.includes(q);
    });
  }, [presetSearch]);

  /* ---------- ingest ---------- */
  function mapTimeRangeToHours(tr) {
    switch (tr) {
      case "24h":
        return 24;
      case "3d":
        return 72;
      case "7d":
        return 7 * 24;
      case "30d":
        return 30 * 24;
      default:
        return null; // "all"
    }
  }

  async function runIngest() {
    setLoading(true);
    setErr("");
    setResult(null);
    try {
      // UI-only right now; kept for future wiring
      const _timeRangeHours = mapTimeRangeToHours(timeRange);

      // IMPORTANT: payload kept same as your existing code (API stays unchanged)
      const payload = {
        feeds,
        limit_per_feed: limit,
        model: MODEL_ID,
        narrative: wantNarr,
        explanation_lang: "auto",
        keywords: keywords && keywords.length ? keywords : undefined,
      };

      const data = await safePOST(`${API_BASE}/stream/news/rss`, payload);
      setResult(data);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  /* ---------- deep / single-article analysis ---------- */
  async function handleDeepAnalysis(item) {
    if (!item?.url) return;

    setActiveDeepItem(item);
    setDeepResult(null);
    setDeepErr("");
    setDeepLoading(true);

    try {
      const payload = {
        url: item.url,
        model: MODEL_ID,
        narrative: true,
        explanation_lang: "auto",
      };

      const data = await safePOST(`${API_BASE}/stream/news/article`, payload);
      setDeepResult(data);
    } catch (e) {
      setDeepErr(e.message || String(e));
    } finally {
      setDeepLoading(false);
    }
  }

  function closeDeepModal() {
    setActiveDeepItem(null);
    setDeepResult(null);
    setDeepErr("");
    setDeepLoading(false);
  }

  /* ---------- derived summary ---------- */
  const counts = result?.summary?.counts || { negative: 0, neutral: 0, positive: 0 };
  const totalCount = (counts.positive || 0) + (counts.neutral || 0) + (counts.negative || 0);
  const posPct = totalCount ? counts.positive / totalCount : 0;
  const neuPct = totalCount ? counts.neutral / totalCount : 0;
  const negPct = totalCount ? counts.negative / totalCount : 0;
  const totalItems = result?.items?.length || 0;

  const overallScore = totalCount ? (counts.positive - counts.negative) / totalCount : 0;
  let overallLabel = "Neutral / Mixed";
  if (overallScore > 0.15) overallLabel = "Overall Positive";
  else if (overallScore < -0.15) overallLabel = "Overall Negative";

  const filteredItems = useMemo(() => {
    let items = result?.items || [];

    if (sentimentFilter !== "all") {
      items = items.filter((i) => (i.label || "neutral").toLowerCase() === sentimentFilter);
    }

    switch (sortBy) {
      case "conf_desc":
        items = [...items].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        break;
      case "conf_asc":
        items = [...items].sort((a, b) => (a.confidence || 0) - (b.confidence || 0));
        break;
      default:
        items = [...items].sort((a, b) => {
          const ad = a.published_at ? new Date(a.published_at).getTime() : 0;
          const bd = b.published_at ? new Date(b.published_at).getTime() : 0;
          return bd - ad;
        });
    }

    return items;
  }, [result, sentimentFilter, sortBy]);

  /* ---------- downloads ---------- */
  function copyLink(u) {
    if (!u) return;
    navigator.clipboard?.writeText(u);
  }

  function downloadJSON() {
    if (!result?.items?.length) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "news_ingest.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadCSV() {
    if (!result?.items?.length) return;
    const csv = toCSV(result.items);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "news_ingest.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ---------- render ---------- */
  return (
    <div className="relative space-y-6">
      {/* Import configuration card */}
      <div className="card bg-slate-950/90 ring-1 ring-sky-500/15 border border-slate-800/80 backdrop-blur-xl p-5 lg:p-6 rounded-2xl shadow-[0_24px_70px_rgba(15,23,42,0.95)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1 text-[11px] text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
              News ingest configuration
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-100">Import Configuration</div>
            <div className="text-[11px] text-slate-400">
              Configure keywords, sources and time range for RSS-based news import.
            </div>
          </div>
          <div className="space-y-1 text-right text-[11px] text-slate-400">
            <div>
              Model:&nbsp;
              <span className="rounded-full border border-slate-700/60 px-2 py-0.5 text-slate-200 bg-slate-900/80">
                {MODEL_ID}
              </span>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 border border-slate-700/70 px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-slate-300">
                {keywords.length} keywords • {feeds.length} sources
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr_1fr]">
          {/* Column 1: Keywords */}
          <div className="rounded-xl border border-slate-800/80 bg-gradient-to-b from-slate-950/90 via-slate-950/80 to-slate-950/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-200">Keywords to Search</div>
              <span className="text-[11px] text-slate-500">{keywords.length} selected</span>
            </div>

            <div className="mb-2 text-[11px] text-slate-400">
              Add custom keywords used to filter imported news in the backend. You can separate multiple with commas.
            </div>

            <div className="flex items-center gap-2 mb-3">
              <input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordKey}
                placeholder="নির্বাচন, অর্থনীতি, খেলা, শিক্ষা…"
                className="flex-1 rounded-lg border border-slate-700/70 bg-[#0f1424]/70 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/60"
              />
              <button
                onClick={addKeyword}
                className="rounded-lg bg-gradient-to-r from-emerald-500 via-sky-500 to-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 shadow-[0_10px_30px_rgba(16,185,129,0.45)]"
              >
                Add
              </button>
            </div>

            <div className="min-h-[70px] rounded-lg border border-dashed border-slate-800/80 bg-slate-950/70 p-2">
              {keywords.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[11px] text-slate-500">
                  No keywords selected
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {keywords.map((k, idx) => (
                    <span
                      key={k}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] text-slate-100 border ${
                        idx % 2 === 0
                          ? "bg-emerald-500/15 border-emerald-400/60"
                          : "bg-sky-500/15 border-sky-400/60"
                      }`}
                    >
                      {k}
                      <button
                        type="button"
                        onClick={() => removeKeyword(k)}
                        className="text-slate-200/80 hover:text-red-300"
                        title="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Sources */}
          <div className="rounded-xl border border-slate-800/80 bg-gradient-to-b from-slate-950/90 via-slate-950/80 to-slate-950/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-200">News Sources</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => selectAllFilteredPresets(filteredPresets)}
                  className="text-[11px] rounded-md border border-slate-700/60 px-2 py-0.5 text-slate-300 hover:bg-slate-900/70"
                  title="Select all shown presets"
                >
                  Select shown
                </button>
                <button
                  onClick={clearAllFeeds}
                  className="text-[11px] rounded-md border border-slate-700/60 px-2 py-0.5 text-slate-300 hover:bg-slate-900/70"
                  title="Clear all"
                >
                  Clear all
                </button>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 mb-2">
              Select Bangla news sources (RSS). You can also add any RSS using the custom box below.
            </div>

            {/* Preset search */}
            <div className="mb-2 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder="Search sources… (e.g., prothom, kaler, bbc)"
                  className="w-full rounded-lg border border-slate-700/70 bg-[#0f1424]/70 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/60"
                />
              </div>
              <span className="text-[10px] text-slate-500 whitespace-nowrap">
                {filteredPresets.length}/{PRESETS.length}
              </span>
            </div>

            {/* Preset list */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {filteredPresets.map((p) => {
                const active = feeds.includes(p.rss);
                return (
                  <button
                    key={p.rss}
                    onClick={() => toggleFeed(p.rss)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                      active
                        ? "border-emerald-400/80 bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-sky-500/10 text-slate-50 shadow-[0_16px_40px_rgba(16,185,129,0.35)]"
                        : "border-slate-800/80 bg-slate-950/85 text-slate-300 hover:bg-slate-900/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {p.name}
                        {p.tag ? (
                          <span className="ml-2 text-[10px] text-slate-500">• {p.tag}</span>
                        ) : null}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate max-w-[170px]">{p.rss}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom RSS add */}
            <div className="mt-3 rounded-xl border border-slate-800/80 bg-slate-950/70 p-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold text-slate-200 inline-flex items-center gap-2">
                  <Plus className="h-3.5 w-3.5 text-sky-300" />
                  Add custom RSS
                </div>
                <span className="text-[10px] text-slate-500">No code edits needed</span>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-2">
                <input
                  value={customRssName}
                  onChange={(e) => setCustomRssName(e.target.value)}
                  placeholder="Optional name (e.g., Dhaka Post)"
                  className="w-full rounded-lg border border-slate-700/70 bg-[#0f1424]/70 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/60"
                />
                <div className="flex gap-2">
                  <input
                    value={customRssUrl}
                    onChange={(e) => setCustomRssUrl(e.target.value)}
                    placeholder="RSS URL (https://.../rss.xml)"
                    className="flex-1 rounded-lg border border-slate-700/70 bg-[#0f1424]/70 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/60"
                  />
                  <button
                    onClick={addCustomFeed}
                    className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 px-3 py-1.5 text-xs font-medium text-slate-950 hover:brightness-110 shadow-[0_10px_30px_rgba(56,189,248,0.35)]"
                    title="Add RSS"
                  >
                    <Plus className="h-4 w-4" /> Add
                  </button>
                </div>

                <div className="text-[10px] text-slate-500">
                  Tip: If a site has no RSS, keep using your backend URL-based single-article analysis.
                </div>
              </div>
            </div>

            {/* Selected feeds chips */}
            <div className="mt-3 rounded-xl border border-slate-800/80 bg-slate-950/70 p-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold text-slate-200 inline-flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-emerald-300" />
                  Selected feeds
                </div>
                <span className="text-[10px] text-slate-500">{feeds.length} active</span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {feeds.length === 0 ? (
                  <div className="text-[11px] text-slate-500">No sources selected</div>
                ) : (
                  feeds.map((u) => (
                    <span
                      key={u}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-200"
                      title={u}
                    >
                      {domainOf(u) || "feed"}
                      <button
                        onClick={() => removeFeed(u)}
                        className="text-slate-300 hover:text-red-300"
                        title="Remove feed"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Column 3: Advanced */}
          <div className="rounded-xl border border-slate-800/80 bg-gradient-to-b from-slate-950/90 via-slate-950/80 to-slate-950/60 p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-200">Advanced Settings</div>

            <div>
              <div className="text-[11px] text-slate-400 mb-1">Time Range</div>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full rounded-lg border border-slate-700/60 bg-[#0f1424]/80 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
              >
                <option value="24h">Past 24 Hours</option>
                <option value="3d">Past 3 Days</option>
                <option value="7d">Past 7 Days</option>
                <option value="30d">Past 30 Days</option>
                <option value="all">All Time</option>
              </select>
              <div className="mt-1 text-[10px] text-slate-500">
                (UI only for now – backend time filtering can be wired later)
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-400 mb-1">Max pages per source</div>
              <input
                type="number"
                min={1}
                max={50}
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value || 5))}
                className="w-full rounded-lg border border-slate-700/60 bg-[#0f1424]/80 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
              />
            </div>

            <label className="mt-1 inline-flex items-center gap-2 text-[11px] text-slate-300">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-slate-700/60 bg-transparent"
                checked={wantNarr}
                onChange={(e) => setWantNarr(e.target.checked)}
              />
              <span>Generate LLM narrative for each article</span>
            </label>

            <div className="mt-2 rounded-lg border border-slate-800/80 bg-slate-950/85 p-3 text-[11px] text-slate-300 space-y-1">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Current setup</div>
              <div>Keywords: {keywords.length}</div>
              <div>Sources: {feeds.length}</div>
              <div>Max pages/source: {limit}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500">
            Configure filters above, then import news articles. Keyword filtering happens in the backend.
          </div>
          <div className="flex items-center gap-3">
            {loading && <Busy text="Importing & analyzing news…" />}
            <button
              onClick={runIngest}
              disabled={loading || feeds.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-sky-500 to-emerald-500 px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60 shadow-[0_20px_50px_rgba(14,165,233,0.55)]"
            >
              <Play className="h-4 w-4" />
              Import News Articles
            </button>
          </div>
        </div>

        {err && <ErrorNote msg={err} />}
      </div>

      {/* Result states */}
      {loading && !result && (
        <div className="space-y-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      )}

      {!loading && !result && (
        <div className="rounded-xl border border-slate-800/70 p-6 text-sm text-slate-300 bg-slate-950/60">
          No results yet. Configure your keywords and sources above, then click{" "}
          <span className="font-semibold text-slate-50">Import News Articles</span>.
        </div>
      )}

      {/* Summary + list when we have result */}
      {result && (
        <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-6">
          {/* Summary card with overall sentiment diagram */}
          <div className="card p-5 rounded-2xl bg-slate-950/85 backdrop-blur ring-1 ring-white/10 border border-slate-800/80 shadow-[0_26px_70px_rgba(15,23,42,0.95)]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-sm font-semibold text-slate-100 inline-flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-sky-300" />
                Sentiment Summary
              </div>
              <span className="text-[11px] text-slate-400">{totalItems} articles</span>
            </div>

            {/* Overall donut + text */}
            <div className="mt-3 flex items-center gap-4">
              <div className="relative h-24 w-24">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(
                      #22c55e ${posPct * 360}deg,
                      #94a3b8 ${posPct * 360}deg ${(posPct + neuPct) * 360}deg,
                      #e11d48 0deg
                    )`,
                  }}
                />
                <div className="absolute inset-2 rounded-full bg-slate-950 flex flex-col items-center justify-center text-center px-2">
                  <span className="text-[10px] text-slate-400">Overall</span>
                  <span className="text-xs font-semibold text-slate-100 leading-tight">{overallLabel}</span>
                  <span className="mt-0.5 text-[10px] text-slate-500">score {overallScore.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-slate-300">
                <div>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Positive:
                  </span>{" "}
                  <span className="font-semibold text-emerald-400">{pct(posPct)}</span> ({counts.positive})
                </div>
                <div>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    Neutral:
                  </span>{" "}
                  <span className="font-semibold text-slate-200">{pct(neuPct)}</span> ({counts.neutral})
                </div>
                <div>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    Negative:
                  </span>{" "}
                  <span className="font-semibold text-rose-400">{pct(negPct)}</span> ({counts.negative})
                </div>
              </div>
            </div>

            {/* Stacked rail under donut */}
            <div className="mt-4 h-3 rounded-full overflow-hidden ring-1 ring-slate-800/80 bg-slate-800/70">
              <div className="h-full float-left bg-emerald-500/90" style={{ width: `${posPct * 100}%` }} />
              <div className="h-full float-left bg-slate-400/80" style={{ width: `${neuPct * 100}%` }} />
              <div className="h-full float-left bg-rose-500/90" style={{ width: `${negPct * 100}%` }} />
            </div>

            {/* Counts / filters / actions */}
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm text-slate-300">
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/8 p-2">
                <div className="text-[11px] text-emerald-200/80">Positive</div>
                <div className="text-lg font-semibold text-emerald-100">{counts.positive}</div>
              </div>
              <div className="rounded-md border border-slate-500/40 bg-slate-700/30 p-2">
                <div className="text-[11px] text-slate-200/80">Neutral</div>
                <div className="text-lg font-semibold text-slate-100">{counts.neutral}</div>
              </div>
              <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2">
                <div className="text-[11px] text-rose-200/90">Negative</div>
                <div className="text-lg font-semibold text-rose-100">{counts.negative}</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5" /> Filter by sentiment:
                </span>
                {["all", "positive", "neutral", "negative"].map((k) => {
                  const active = sentimentFilter === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setSentimentFilter(k)}
                      className={`rounded-full px-2.5 py-1 text-[11px] border transition ${
                        active
                          ? FILTER_STYLES[k]
                          : "border-slate-700/60 text-slate-300 hover:bg-slate-900/60"
                      }`}
                    >
                      {k}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-lg border border-slate-700/60 bg-[#0f1424]/80 px-2.5 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
                  title="Sort by"
                >
                  <option value="published_desc">Newest first</option>
                  <option value="conf_desc">Conf: High → Low</option>
                  <option value="conf_asc">Conf: Low → High</option>
                </select>

                <button
                  onClick={downloadJSON}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700/60 bg-slate-800/50 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800/80"
                >
                  <Download className="h-3.5 w-3.5" /> JSON
                </button>
                <button
                  onClick={downloadCSV}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700/60 bg-slate-800/50 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-800/80"
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
              </div>
            </div>
          </div>

          {/* Items list */}
          <div className="space-y-2">
            {filteredItems.length === 0 && (
              <div className="rounded-xl border border-slate-800/70 p-6 text-sm text-slate-300 bg-slate-950/60">
                No articles match the current sentiment filters.
              </div>
            )}

            {filteredItems.map((it, i) => {
              const lab = (it.label || "neutral").toLowerCase();
              const sentimentBorder =
                lab === "positive"
                  ? "border-emerald-500/40"
                  : lab === "negative"
                  ? "border-rose-500/40"
                  : "border-slate-700/70";

              const fav = faviconOf(it.url);
              const siteOrSource = it.site || it.source || domainOf(it.url) || "—";

              const rawContent = it.narrative || it.body || it.content || it.summary || "";
              const hasNarrative = Boolean(it.narrative);

              return (
                <div
                  key={`${it.url}-${i}`}
                  className={`rounded-xl border p-3.5 bg-slate-950/75 ${sentimentBorder} shadow-[0_18px_45px_rgba(15,23,42,0.9)] hover:border-sky-500/60 hover:bg-slate-900/90 transition`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-slate-50 font-medium break-words">{it.title || "Untitled"}</div>

                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <a
                          href={it?.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-slate-400 break-all hover:text-slate-200"
                          title="Open original"
                        >
                          <LinkIcon className="h-3.5 w-3.5" />
                          {it.url}
                        </a>

                        <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/80 px-2 py-0.5 text-[11px] text-slate-300">
                          {fav ? (
                            <img src={fav} alt="" className="h-3.5 w-3.5 rounded-sm" />
                          ) : (
                            <Globe className="h-3 w-3" />
                          )}
                          {siteOrSource}
                        </span>

                        <button
                          onClick={() => copyLink(it.url)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-700/60 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800/80"
                          title="Copy link"
                        >
                          <Copy className="h-3.5 w-3.5" /> Copy
                        </button>

                        <a
                          href={it.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-slate-700/60 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800/80"
                          title="Open"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Open
                        </a>
                      </div>

                      <div className="mt-1 text-[11px] text-slate-500 flex flex-wrap gap-3">
                        <span>
                          Published: {niceDate(it.published_at)}{" "}
                          <span className="text-slate-400">({timeAgo(it.published_at)})</span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {siteOrSource}
                        </span>
                        {hasNarrative && (
                          <span className="rounded-full border border-slate-700/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-200 bg-slate-900/80">
                            LLM narrative
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Sentiment + Deep button */}
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <div className={labToClass(lab)}>
                        <span className="capitalize">{lab}</span>
                        <span className="opacity-80">{Number(it.confidence ?? 0).toFixed(2)}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeepAnalysis(it)}
                        className="inline-flex items-center gap-1 rounded-full border border-sky-400 bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 px-3 py-1 text-[10px] font-medium text-slate-950 shadow-[0_0_18px_rgba(56,189,248,0.7)] hover:brightness-110 hover:shadow-[0_0_26px_rgba(56,189,248,0.9)] hover:scale-[1.03] transition"
                        title="Deep / single analysis for this article"
                      >
                        <Search className="h-3.5 w-3.5" />
                        <span>Deep analysis</span>
                      </button>
                    </div>
                  </div>

                  {rawContent && (
                    <div className="mt-2 text-sm text-slate-200 rounded-md border border-slate-700/70 p-2 bg-[#0f1424]/80">
                      {clampTxt(rawContent, 320)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating loading overlay over this section only (for ingest) */}
      {loading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-md rounded-2xl">
          <div className="rounded-2xl border border-sky-500/70 bg-slate-950/95 px-6 py-5 shadow-[0_32px_80px_rgba(8,47,73,0.95)] max-w-sm w-[90%] sm:w-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <div className="h-9 w-9 rounded-full border border-sky-500/60 flex items-center justify-center bg-slate-900/80">
                  <RefreshCcw className="h-4 w-4 animate-spin text-sky-300" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
                  Importing news
                </span>
                <span className="text-[12px] text-slate-300">
                  Fetching RSS feeds, deduplicating and running sentiment analysis…
                </span>
              </div>
            </div>

            <div className="mt-1 flex items-center justify-between text-[12px] text-slate-200">
              <span>Total elapsed</span>
              <span className="font-mono text-[11px] tabular-nums text-sky-200">
                {fmtTime(loadingElapsed)}
              </span>
            </div>

            <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-sky-400 via-emerald-400 to-sky-500 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* Deep analysis floating modal */}
      {activeDeepItem && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md rounded-2xl">
          <div className="relative w-[95%] max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border border-sky-500/40 bg-gradient-to-br from-slate-950 via-slate-950/95 to-slate-900/95 p-5 shadow-[0_24px_80px_rgba(8,47,73,0.95)]">
            <button
              onClick={closeDeepModal}
              className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-600/70 bg-slate-900/80 text-slate-300 hover:bg-slate-800"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3 pr-8">
              <div className="h-8 w-8 rounded-xl border border-sky-500/60 bg-sky-500/10 flex items-center justify-center">
                <Search className="h-4 w-4 text-sky-300" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">
                  Single Article Analysis
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-50">
                  {activeDeepItem.title || "Untitled article"}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                  <a
                    href={activeDeepItem.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-slate-200 break-all"
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    {activeDeepItem.url}
                  </a>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/70 bg-slate-900/80 px-2 py-0.5">
                    <MapPin className="h-3 w-3" />
                    {activeDeepItem.site || activeDeepItem.source || domainOf(activeDeepItem.url) || "Unknown source"}
                  </span>
                  <span className="text-slate-500">
                    Published: {niceDate(activeDeepItem.published_at)}{" "}
                    <span className="text-slate-500">({timeAgo(activeDeepItem.published_at)})</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/90 p-4 space-y-3">
                {(() => {
                  const deepLabel = (deepResult?.label || activeDeepItem.label || "neutral").toLowerCase();
                  const deepConf = Number(deepResult?.confidence ?? activeDeepItem.confidence ?? 0);
                  const confPct = Math.round(deepConf * 100);

                  return (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-slate-200">Sentiment & confidence</div>
                        <div className={labToClass(deepLabel)}>
                          <span className="capitalize">{deepLabel}</span>
                          <span className="opacity-80">{deepConf.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Model confidence</span>
                          <span className="font-mono text-sky-300">{confPct}%</span>
                        </div>
                        <div className="h-3 w-full rounded-full bg-slate-800/90 overflow-hidden ring-1 ring-slate-700/70">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${
                              deepLabel === "positive"
                                ? "from-emerald-400 via-emerald-500 to-sky-400"
                                : deepLabel === "negative"
                                ? "from-rose-500 via-rose-600 to-orange-400"
                                : "from-slate-300 via-slate-400 to-sky-300"
                            }`}
                            style={{ width: `${confPct}%` }}
                          />
                        </div>
                      </div>

                      {deepResult?.probs && (
                        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-300">
                          {["positive", "neutral", "negative"].map((k) => (
                            <div
                              key={k}
                              className="rounded-md border border-slate-700/70 bg-slate-900/80 p-2"
                            >
                              <div className="text-slate-400 capitalize">{k}</div>
                              <div className="text-sm font-semibold">{pct(deepResult.probs[k] || 0)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-950/90 p-4 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-200">LLM Explanation</div>
                  {deepLoading && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-sky-300">
                      <RefreshCcw className="h-3 w-3 animate-spin" />
                      Analyzing…
                    </span>
                  )}
                </div>

                <div className="mt-2 flex-1 rounded-lg border border-slate-800/80 bg-slate-950/80 p-3 text-[12px] text-slate-200 leading-relaxed max-h-64 overflow-y-auto">
                  {deepErr && (
                    <div className="text-red-300 text-xs">Failed to run deep analysis: {deepErr}</div>
                  )}

                  {!deepErr && deepLoading && (
                    <div className="text-[12px] text-slate-400">
                      Running single-article sentiment and generating LLM explanation…
                    </div>
                  )}

                  {!deepLoading && !deepErr && (
                    <div>
                      {deepResult?.explanation ||
                        deepResult?.narrative ||
                        "No explanation text returned from the model."}
                    </div>
                  )}
                </div>

                {activeDeepItem && (
                  <div className="mt-3 text-[11px] text-slate-400">
                    <div className="mb-1 font-semibold text-slate-300">Article snippet</div>
                    <div className="rounded-lg border border-slate-800/80 bg-slate-950/80 p-2 text-[11px] text-slate-300 max-h-32 overflow-y-auto">
                      {clampTxt(
                        activeDeepItem.narrative ||
                          activeDeepItem.body ||
                          activeDeepItem.content ||
                          activeDeepItem.summary ||
                          "",
                        420
                      ) || "No content snippet available."}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
