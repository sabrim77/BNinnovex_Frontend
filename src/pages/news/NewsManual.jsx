// path: src/pages/news/NewsManual.jsx
import React, { useState, useMemo, useEffect } from "react";
import {
  Play,
  AlertCircle,
  RefreshCcw,
  Globe,
  CalendarClock,
  Link as LinkIcon,
  Copy,
  Download,
} from "lucide-react";
import { API_BASE } from "../../api.js";

/* ---------- tiny helpers ---------- */
const pct = (v) => `${Math.round(Number(v || 0) * 100)}%`;
const clampTxt = (s, n = 320) =>
  !s ? "" : s.length > n ? s.slice(0, n) + "…" : s;
const nice = (d) => (d ? new Date(d).toLocaleString() : "—");

const fmtTime = (sec) => {
  if (!sec && sec !== 0) return "00:00";
  const s = String(sec % 60).padStart(2, "0");
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  return `${m}:${s}`;
};

const sentimentPillClass = (lab) => {
  switch ((lab || "").toLowerCase()) {
    case "positive":
      return "inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.35)]";
    case "negative":
      return "inline-flex items-center gap-1 rounded-full border border-rose-500/60 bg-rose-500/15 px-2 py-0.5 text-[11px] text-rose-200 shadow-[0_0_10px_rgba(244,63,94,0.35)]";
    default:
      return "inline-flex items-center gap-1 rounded-full border border-slate-500/70 bg-slate-800/70 px-2 py-0.5 text-[11px] text-slate-200";
  }
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
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
        d,
      )}&sz=64`
    : "";
};

const Busy = ({ text = "Working…" }) => (
  <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-slate-950/80 px-3 py-2 text-slate-100 shadow-[0_18px_45px_rgba(15,23,42,0.9)]">
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

function Skeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-gradient-to-r from-slate-800/80 via-slate-900/80 to-slate-800/80 ${className}`}
    />
  );
}

/* ----------------------------- main component ----------------------------- */

const MODEL = "onnx-optimized";

export default function NewsManual() {
  const [url, setUrl] = useState("");
  const [wantNarr, setWantNarr] = useState(true);

  const [loading, setLoading] = useState(false);
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const [err, setErr] = useState("");
  const [res, setRes] = useState(null); // API response
  const [copied, setCopied] = useState(false);

  /* ---------- loading timer ---------- */
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

  async function runAnalyze() {
    if (!url.trim() || loading) return;
    setLoading(true);
    setErr("");
    setRes(null);
    try {
      const data = await safePOST(`${API_BASE}/stream/news/article`, {
        url,
        model: MODEL,
        narrative: wantNarr,
        explanation_lang: "auto",
      });
      setRes(data);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // ---- derived article fields (headline + body + meta) ----
  const article = res?.article || {};
  const articleUrl = article.url || res?.url || url || "";
  const articleTitle = article.title || res?.title || "Untitled article";
  const articleBody = article.body || res?.body || res?.content || "";
  const articleSite =
    article.site_name || res?.site || domainOf(articleUrl);
  const articlePublishedAt =
    article.published_at || res?.published_at || null;
  const articleLang = article.language || res?.language || "";
  const articleImage = article.image_url || res?.image_url || "";

  const domain = articleUrl ? domainOf(articleUrl) : "";
  const fav = articleUrl ? faviconOf(articleUrl) : "";

  // distribution + confidence
  const dist = res?.distribution || {};
  const pos = Number(dist.positive || 0);
  const neu = Number(dist.neutral || 0);
  const neg = Number(dist.negative || 0);

  // Donut
  const donutStyle = useMemo(() => {
    const a = Math.round(Math.max(0, Math.min(1, pos)) * 360);
    const b = Math.round(Math.max(0, Math.min(1, pos + neu)) * 360);
    return {
      background: `conic-gradient(
        rgb(16 185 129) 0deg ${a}deg,
        rgb(100 116 139) ${a}deg ${b}deg,
        rgb(244 63 94) ${b}deg 360deg
      )`,
    };
  }, [pos, neu]);

  const confidence = Number(res?.confidence ?? 0);
  const confPct = Math.max(0, Math.min(100, Math.round(confidence * 100)));

  // hue for confidence rail
  const hue = useMemo(() => {
    const score = pos - neg; // roughly [-1,1]
    const t = Math.max(-1, Math.min(1, score));
    return Math.round(((t + 1) / 2) * 120); // -1..1 → 0..120 (red→green)
  }, [pos, neg]);

  async function copyUrl() {
    if (!articleUrl) return;
    await navigator.clipboard.writeText(articleUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  function downloadJSON() {
    if (!res) return;
    const blob = new Blob([JSON.stringify(res, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `article-sentiment.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const articleExcerpt = useMemo(
    () => clampTxt(articleBody, 800),
    [articleBody],
  );

  return (
    <div className="relative space-y-5">
      {/* TOP: left = input, right = preview */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Left: controls */}
        <div>
          <div className="card p-5 sm:p-6 bg-slate-950/85 backdrop-blur-xl ring-1 ring-sky-500/15 border border-slate-800/80 rounded-2xl shadow-[0_24px_70px_rgba(15,23,42,0.95)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1 text-[11px] text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                  Single article analysis
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-100">
                  Analyze single article
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Uses <code className="text-[10px]">onnx-optimized</code> to
                  score sentiment, plus optional LLM narrative.
                </div>
              </div>
              {res?.model_used && (
                <div className="text-[11px] text-slate-400">
                  Model used:{" "}
                  <code className="text-[10px]">
                    {String(res.model_used)}
                  </code>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {/* URL input + button */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <span className="absolute left-2 top-2.5 text-slate-500">
                    <LinkIcon className="h-4 w-4" />
                  </span>
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/news/..."
                    className="pl-8 w-full rounded-lg border border-slate-700/70 bg-[#0f1424]/70 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-slate-500 placeholder:text-slate-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && url && !loading) runAnalyze();
                    }}
                  />
                </div>
                <button
                  onClick={runAnalyze}
                  disabled={!url.trim() || loading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-sky-500 to-emerald-500 px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60 shadow-[0_16px_45px_rgba(14,165,233,0.6)] whitespace-nowrap"
                  title="Analyze article"
                >
                  {loading ? (
                    <>
                      <RefreshCcw className="h-4 w-4 animate-spin" />
                      <span className="hidden sm:inline">Analyzing…</span>
                      <span className="sm:hidden">…</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      <span className="hidden sm:inline">Analyze</span>
                      <span className="sm:hidden">Go</span>
                    </>
                  )}
                </button>
              </div>

              {/* Narrative toggle */}
              <div className="flex items-center justify-between text-xs text-slate-200">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-slate-700/60 bg-transparent"
                    checked={wantNarr}
                    onChange={(e) => setWantNarr(e.target.checked)}
                  />
                  <span>Include LLM narrative (if available)</span>
                </label>
              </div>

              {/* Loading / error states */}
              {loading && (
                <div className="mt-1">
                  <Busy text="Fetching article & running sentiment…" />
                </div>
              )}
              {err && <ErrorNote msg={err} />}
            </div>
          </div>
        </div>

        {/* Right: preview */}
        <div>
          <div className="card p-5 sm:p-6 bg-slate-950/85 backdrop-blur-xl ring-1 ring-white/10 border border-slate-800/80 h-full flex flex-col rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                News preview
              </div>
              {res?.overall_sentiment && (
                <div
                  className={sentimentPillClass(
                    res.overall_sentiment || "neutral",
                  )}
                >
                  <span className="capitalize">
                    {res.overall_sentiment || "neutral"}
                  </span>
                  <span className="opacity-80">
                    {Number(res.confidence ?? 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {loading && !res && (
              <div className="space-y-3">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            )}

            {!loading && !res && (
              <div className="text-sm text-slate-400">
                Paste a news URL on the left and click <b>Analyze</b> to see a
                preview here.
              </div>
            )}

            {res && (
              <div className="flex-1 flex flex-col gap-3">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-slate-100 break-words">
                    {articleTitle}
                  </div>

                  {/* URL + meta row */}
                  <div className="flex flex-wrap items-center gap-2">
                    {articleUrl && (
                      <a
                        href={articleUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-slate-400 break-all hover:text-slate-200"
                        title="Open original article"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                        {articleUrl}
                      </a>
                    )}

                    {domain && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-900/80 px-2 py-0.5 text-[11px] text-slate-300">
                        {fav ? (
                          <img
                            src={fav}
                            alt=""
                            className="h-3.5 w-3.5 rounded-sm"
                          />
                        ) : (
                          <Globe className="h-3 w-3" />
                        )}
                        {domain}
                      </span>
                    )}

                    {articleLang && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-900/80 px-2 py-0.5 text-[11px] text-slate-300">
                        <Globe className="h-3 w-3" />
                        {articleLang}
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {nice(articlePublishedAt)}
                    </span>
                    {articleSite && (
                      <span className="inline-flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5" />
                        {articleSite}
                      </span>
                    )}
                  </div>
                </div>

                {articleImage && (
                  <div className="overflow-hidden rounded-lg border border-slate-800/70 bg-slate-950/40">
                    <img
                      src={articleImage}
                      alt={articleTitle}
                      className="w-full max-h-44 object-cover"
                    />
                  </div>
                )}

                <div className="flex-1 rounded-lg border border-slate-700/70 bg-[#0f1424]/75 p-3">
                  <div className="text-[11px] font-medium text-slate-300 mb-1">
                    Body snippet
                  </div>
                  <div className="text-[12px] text-slate-400 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {articleExcerpt || (
                      <span className="text-slate-500">
                        No body text was extracted from this article.
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-1 flex gap-2 text-[11px]">
                  {articleUrl && (
                    <button
                      onClick={copyUrl}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-700/60 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800/80"
                      title="Copy article link"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copied ? "Copied!" : "Copy URL"}
                    </button>
                  )}
                  {res && (
                    <button
                      onClick={downloadJSON}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-700/60 bg-slate-900/70 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800/80"
                      title="Download raw JSON"
                    >
                      <Download className="h-3.5 w-3.5" />
                      JSON
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM: result section under both */}
      {res && (
        <div className="card p-5 sm:p-6 bg-slate-950/85 backdrop-blur-xl ring-1 ring-white/10 border border-slate-800/80 rounded-2xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-100">
              Sentiment result
            </div>
            <div className="text-[11px] text-slate-400">
              Overall:{" "}
              <span className="inline-flex items-center gap-2">
                <span
                  className={sentimentPillClass(
                    res.overall_sentiment || "neutral",
                  )}
                >
                  <span className="capitalize">
                    {res.overall_sentiment || "neutral"}
                  </span>
                  <span className="opacity-80">
                    {Number(res.confidence ?? 0).toFixed(2)}
                  </span>
                </span>
              </span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: donut + bars */}
            <div className="space-y-4">
              <div className="grid grid-cols-[minmax(96px,9rem)_1fr] gap-5 items-center">
                {/* Donut */}
                <div className="relative h-24 w-24 md:h-28 md:w-28 mx-auto">
                  <div
                    className="relative h-full w-full rounded-full shadow-inner ring-1 ring-slate-800/70"
                    style={donutStyle}
                  />
                  <div className="absolute inset-[18%] rounded-full bg-slate-950/95 border border-slate-800/70" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-[10px] text-slate-400">
                        conf
                      </div>
                      <div className="text-sm font-semibold text-slate-100">
                        {Number(res.confidence ?? 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bars */}
                <div className="space-y-2">
                  {[
                    ["positive", pos, "bg-emerald-500/90"],
                    ["neutral", neu, "bg-slate-400/90"],
                    ["negative", neg, "bg-rose-500/90"],
                  ].map(([k, v, cls]) => {
                    const w = Math.max(
                      0,
                      Math.min(100, Math.round(Number(v) * 100)),
                    );
                    return (
                      <div key={k}>
                        <div className="flex justify-between text-xs text-slate-300">
                          <span className="capitalize">{k}</span>
                          <span className="tabular-nums text-slate-400">
                            {pct(v)}
                          </span>
                        </div>
                        <div className="h-2.5 rounded-lg overflow-hidden bg-slate-800/60 ring-1 ring-slate-800/80">
                          <div
                            className={`h-full rounded-r-lg transition-[width] duration-500 ease-out ${cls}`}
                            style={{ width: `${w}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {/* Confidence rail */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span>confidence</span>
                      <span className="tabular-nums text-slate-400">
                        {confPct}%
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-lg bg-slate-800/60 ring-1 ring-slate-800/80">
                      <div
                        className="h-full rounded-r-lg transition-[width] duration-500 ease-out"
                        style={{
                          width: `${confPct}%`,
                          background: `linear-gradient(90deg, hsl(${hue} 85% 60%), hsl(${hue} 85% 50%))`,
                        }}
                        title={`${confPct}%`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400">
                Distribution: pos {pct(pos)}, neu {pct(neu)}, neg {pct(neg)}
              </div>
            </div>

            {/* Right: narrative */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-100">
                Narrative
              </div>
              <div className="rounded-lg border border-slate-700/70 bg-[#0f1424]/80 p-3 text-sm text-slate-300 min-h-[110px] whitespace-pre-wrap">
                {res.narrative ? (
                  res.narrative
                ) : (
                  <span className="text-slate-500">
                    No narrative returned.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Optional bottom skeleton when loading first time */}
      {loading && !res && (
        <div className="card p-5 sm:p-6 bg-slate-950/70 ring-1 ring-white/10 border border-slate-800/80 rounded-2xl">
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      )}

      {/* Floating loading overlay over this page section (keeps sidebar/navbar visible) */}
      {loading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-md rounded-2xl">
          <div className="rounded-2xl border border-sky-500/70 bg-slate-950/95 px-6 py-5 shadow-[0_32px_80px_rgba(8,47,73,0.95)] max-w-sm w-[90%] sm:w-auto">
            <div className="flex items-center gap-3 mb-3">
              <RefreshCcw className="h-5 w-5 animate-spin text-sky-300" />
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
                  Analyzing article
                </span>
                <span className="text-[12px] text-slate-400">
                  Fetching content and running sentiment + narrative…
                </span>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between text-[12px] text-slate-200">
              <span>Total elapsed</span>
              <span className="font-mono text-[11px] tabular-nums text-sky-200">
                {fmtTime(loadingElapsed)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
