// path: src/pages/YouTubeAnalysis.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../api.js";
import Navbar from "../components/layout/Navbar.jsx";
import Sidebar from "../components/layout/Sidebar.jsx";
import ErrorBoundary from "../components/dev/ErrorBoundary.jsx";
import Spinner from "../components/feedback/Spinner.jsx";
import {
  Play,
  Info,
  PieChart as PieIcon,
  MessageSquare,
  ShieldAlert,
  Copy,
  Download,
  FileText,
  Activity,
  BarChart3,
  Waves,
  Timer,
} from "lucide-react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend,
} from "recharts";

/* --------------------------------- Helpers --------------------------------- */

const cx = (...x) => x.filter(Boolean).join(" ");

const clamp01 = (v) => Math.max(0, Math.min(1, typeof v === "number" ? v : 0));

const fmtTime = (sec) => {
  if (sec == null || isNaN(sec)) return "—";
  const s = String(Math.floor(sec % 60)).padStart(2, "0");
  const m = String(Math.floor((sec / 60) % 60)).padStart(2, "0");
  const h = Math.floor(sec / 3600);
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
};

function getYtId(u) {
  try {
    const url = new URL(u);
    if (url.hostname.includes("youtu.be")) return url.pathname.slice(1);
    if (url.pathname.startsWith("/shorts/")) {
      return (url.pathname.split("/")[2] || "").trim();
    }
    return url.searchParams.get("v") || "";
  } catch {
    return "";
  }
}

const getLabel = (s) =>
  (s
    ? (
        s.overall_sentiment ??
        s.sentiment ??
        s.overall ??
        s.label ??
        ""
      )
        .toString()
        .trim()
        .toLowerCase()
    : "");

/* Error mapping */
function friendlyError(eText) {
  const t = (eText || "").toLowerCase();
  if (t.includes("429") || t.includes("rate"))
    return "YouTube timedtext rate-limited (429). Try again later or use Whisper.";
  if (t.includes("no transcript found"))
    return "No CC/Whisper transcript available for this range.";
  if (t.includes("quota"))
    return "YouTube quota exceeded. Try later or adjust usage.";
  if (t.includes("ffmpeg"))
    return "ffmpeg is missing or misconfigured on the backend.";
  if (t.includes("network") || t.includes("fetch") || t.includes("aborted"))
    return "Network issue while contacting the API.";
  return eText || "Something went wrong.";
}

function buildTranscript(segments) {
  if (!Array.isArray(segments) || !segments.length) return "";
  return segments
    .map((s) => String(s?.text || "").trim())
    .filter(Boolean)
    .join("\n");
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function downloadTxt(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ----------------------------- Sentiment Utils ----------------------------- */

function calcScoresArray(segments) {
  if (!Array.isArray(segments) || !segments.length) return [];
  const toNum = (s) => {
    const l = (
      s?.label ??
      s?.sentiment ??
      s?.overall ??
      s?.overall_sentiment ??
      ""
    )
      .toString()
      .toLowerCase();
    if (l === "positive") return 1;
    if (l === "negative") return -1;
    return 0;
  };
  return segments.map(toNum);
}

function calcPolarityScore(segments) {
  const vals = calcScoresArray(segments);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length; // [-1,1]
}

function inferOverallLabelFromPolarity(avg, threshold = 0.15) {
  if (avg > threshold) return "positive";
  if (avg < -threshold) return "negative";
  return "neutral";
}

function inferConfidence(pos, neu, neg) {
  const total = Math.max(pos + neu + neg, 1);
  return Math.max(pos, neu, neg) / total;
}

function sentimentChipClasses(label) {
  switch ((label || "").toLowerCase()) {
    case "positive":
      return "border-emerald-500/40 text-emerald-200";
    case "negative":
      return "border-rose-500/40 text-rose-200";
    case "neutral":
      return "border-slate-500/40 text-slate-200";
    default:
      return "border-slate-700 text-slate-200";
  }
}

const sentimentColor = (lab) =>
  lab === "positive"
    ? "rgb(16,185,129)"
    : lab === "negative"
    ? "rgb(244,63,94)"
    : "rgb(100,116,139)";

/* ------------------------------ Small UI bits ------------------------------ */

function LegendRow({ color, label, value }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-slate-200">{label}</span>
      <span className="ml-auto text-slate-400 tabular-nums">{value}</span>
    </div>
  );
}

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
          collapsed ? "grid-cols-[80px_1fr]" : "grid-cols-[280px_1fr]"
        )}
      >
        <aside
          className="h-full min-w-0 border-r border-slate-800/60 bg-slate-950/40 backdrop-blur"
          aria-label="Primary navigation"
          role="region"
        >
          <ErrorBoundary>
            <Sidebar collapsed={collapsed} />
          </ErrorBoundary>
        </aside>
        <main className="relative h-full min-h-0 overflow-y-auto px-4 md:px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function Stat({ k, v, badge = false, tone, progress = null }) {
  const chipClass = sentimentChipClasses(tone);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{k}</div>
      {badge ? (
        <div
          className={cx(
            "mt-1 inline-flex items-center gap-2 px-2 py-0.5 rounded border text-xs",
            chipClass
          )}
        >
          <PieIcon className="h-4 w-4 opacity-80" /> {v}
        </div>
      ) : (
        <div className="text-sm text-slate-100 mt-0.5 break-all">{String(v)}</div>
      )}
      {typeof progress === "number" && progress >= 0 && progress <= 1 && (
        <div className="mt-2 h-1.5 w-full rounded bg-slate-800 overflow-hidden">
          <div className="h-full bg-blue-500" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Viz: Donut --------------------------------- */

const Donut = React.memo(function Donut({ pos = 0, neu = 0, neg = 0, size = 178, stroke = 16 }) {
  const total = Math.max(pos + neu + neg, 1);
  const R = (size - stroke) / 2;
  const C = 2 * Math.PI * R;

  const Lpos = (pos / total) * C;
  const Lneu = (neu / total) * C;
  const Lneg = (neg / total) * C;

  const gap = 2.2;
  const offPos = 0;
  const offNeu = Lpos + gap * 1.2;
  const offNeg = Lpos + Lneu + gap * 2.4;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`rotate(-90 ${size / 2} ${size / 2})`} filter="url(#softGlow)">
          <circle cx={size / 2} cy={size / 2} r={R} fill="none" className="stroke-slate-800" strokeWidth={stroke} />

          <circle
            cx={size / 2}
            cy={size / 2}
            r={R}
            fill="none"
            stroke="rgb(16,185,129)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${Lpos} ${C - Lpos}`}
            strokeDashoffset={offPos}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={R}
            fill="none"
            stroke="rgb(100,116,139)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${Lneu} ${C - Lneu}`}
            strokeDashoffset={offNeu}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={R}
            fill="none"
            stroke="rgb(244,63,94)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${Lneg} ${C - Lneg}`}
            strokeDashoffset={offNeg}
          />
        </g>
      </svg>

      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Segments</div>
          <div className="text-[22px] font-semibold text-slate-100 tabular-nums">{pos + neu + neg}</div>
          <div className="mt-0.5 text-[10px] text-slate-500">windowed</div>
        </div>
      </div>
    </div>
  );
});

/* --------------------------------- Cards --------------------------------- */

function VizCard({ title, icon: Icon, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/55 backdrop-blur p-4 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2">
            {Icon ? <Icon className="h-4 w-4 text-sky-300" /> : null}
            <div className="text-[13px] font-semibold text-slate-100 truncate">{title}</div>
          </div>
          {subtitle ? <div className="mt-0.5 text-[11px] text-slate-400">{subtitle}</div> : null}
        </div>
      </div>

      <div className="mt-3 h-[240px]">{children}</div>
    </div>
  );
}

function EmptyViz() {
  return (
    <div className="h-full grid place-items-center">
      <div className="text-[12px] text-slate-500">No segments yet</div>
    </div>
  );
}

/* ------------------------------- Main Page ------------------------------- */

export default function YouTubeAnalysis() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState(null);
  const [error, setError] = useState(null);

  const [deepResp, setDeepResp] = useState(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepError, setDeepError] = useState(null);

  // timers for visual feedback
  const [analysisElapsed, setAnalysisElapsed] = useState(0);
  const [deepElapsed, setDeepElapsed] = useState(0);

  const segments = Array.isArray(resp?.segments) ? resp.segments : [];

  const ytId = useMemo(
    () => getYtId(url) || resp?.video_id || resp?.yt_id || resp?.youtube_id || "",
    [url, resp]
  );

  const transcript = useMemo(() => buildTranscript(segments), [segments]);

  const pos = segments.filter((s) => getLabel(s) === "positive").length;
  const neu = segments.filter((s) => getLabel(s) === "neutral").length;
  const neg = segments.filter((s) => getLabel(s) === "negative").length;
  const totalSeg = pos + neu + neg;

  // Windowed (stream) overall
  const apiOverallLabel =
    resp?.overall?.label ??
    resp?.overall?.sentiment ??
    resp?.overall_label ??
    null;

  const streamOverallLabel =
    (apiOverallLabel ? String(apiOverallLabel) : "").toLowerCase() ||
    inferOverallLabelFromPolarity(calcPolarityScore(segments));

  const avgConf = resp?.summary?.avg_confidence;
  const apiOverallConf = resp?.overall?.confidence ?? resp?.overall_confidence;
  const streamOverallConf =
    typeof apiOverallConf === "number"
      ? clamp01(apiOverallConf)
      : typeof avgConf === "number"
      ? clamp01(avgConf)
      : clamp01(inferConfidence(pos, neu, neg));

  const polarityScore = useMemo(() => calcPolarityScore(segments), [segments]);

  // Deep analysis (single-text /analyze)
  const deepOverallLabelRaw =
    deepResp?.overall_sentiment ??
    deepResp?.label ??
    deepResp?.sentiment ??
    null;
  const deepOverallLabel = deepOverallLabelRaw
    ? String(deepOverallLabelRaw).toLowerCase()
    : null;

  const deepOverallConf = clamp01(deepResp?.confidence);

  // Choose what to show in headline
  const headlineLabel = deepOverallLabel || streamOverallLabel;
  const headlineConf =
    typeof deepOverallConf === "number" && !Number.isNaN(deepOverallConf)
      ? deepOverallConf
      : streamOverallConf;

  // Summary from streaming (optional, NOT explanation)
  const streamSummaryText = resp?.summary_text || "";
  const streamSummaryBullets = resp?.summary_bullets || [];

  // Deep narrative (LLM explanation / narrative) + fallback
  const rawDeepNarrative =
    deepResp?.narrative ||
    deepResp?.explanation ||
    "";

  const computedFallbackExplanation =
    deepResp && !rawDeepNarrative
      ? `Model predicts "${headlineLabel || "—"}" overall sentiment with about ${(
          headlineConf * 100
        ).toFixed(1)}% confidence based on the full transcript.`
      : "";

  const effectiveExplanation = rawDeepNarrative || computedFallbackExplanation;

  const combinedSingleText = useMemo(() => {
    if (
      !deepResp &&
      !headlineLabel &&
      !streamSummaryText &&
      !streamSummaryBullets.length &&
      !effectiveExplanation
    ) {
      return "";
    }
    const parts = [];
    if (headlineLabel) {
      const confPct = `${Math.round(headlineConf * 1000) / 10}%`;
      parts.push(`Overall sentiment: ${headlineLabel} (${confPct} confidence)`);
    }
    if (streamSummaryText) {
      parts.push(`Summary:\n${streamSummaryText}`);
    }
    if (streamSummaryBullets?.length) {
      parts.push("Key points:\n" + streamSummaryBullets.map((b) => `- ${b}`).join("\n"));
    }
    if (effectiveExplanation) {
      parts.push(`Explanation:\n${effectiveExplanation}`);
    }
    return parts.join("\n\n");
  }, [
    deepResp,
    headlineLabel,
    headlineConf,
    streamSummaryText,
    streamSummaryBullets,
    effectiveExplanation,
  ]);

  /* ----------------------------- NEW: YouTube visual datasets ----------------------------- */

  // 1) Segment timeline (score vs time)
  const segmentTimeline = useMemo(() => {
    if (!segments.length) return [];
    return segments
      .map((s, i) => {
        const lab = getLabel(s) || "neutral";
        const score = lab === "positive" ? 1 : lab === "negative" ? -1 : 0;

        // Try common time fields; fallback to index * window_seconds if missing
        const start =
          typeof s?.start === "number"
            ? s.start
            : typeof s?.start_sec === "number"
            ? s.start_sec
            : typeof s?.t0 === "number"
            ? s.t0
            : typeof s?.begin === "number"
            ? s.begin
            : i * (resp?.params_used?.window_seconds ?? 20);

        const end =
          typeof s?.end === "number"
            ? s.end
            : typeof s?.end_sec === "number"
            ? s.end_sec
            : typeof s?.t1 === "number"
            ? s.t1
            : typeof s?.finish === "number"
            ? s.finish
            : start + (resp?.params_used?.window_seconds ?? 20);

        const conf = clamp01(
          typeof s?.confidence === "number"
            ? s.confidence
            : typeof s?.conf === "number"
            ? s.conf
            : typeof s?.score === "number"
            ? clamp01(Math.abs(s.score))
            : 0
        );

        const len = (s?.text || "").trim().length;

        return {
          idx: i + 1,
          t: start,
          tLabel: fmtTime(start),
          score,
          label: lab,
          conf,
          chars: len,
          dur: Math.max(1, end - start),
        };
      })
      .sort((a, b) => a.t - b.t);
  }, [segments, resp?.params_used?.window_seconds]);

  // 2) Rolling mean + volatility band
  const rollingTimeline = useMemo(() => {
    const data = segmentTimeline;
    if (!data.length) return [];
    const k = Math.min(9, Math.max(3, Math.floor(data.length / 12) * 2 + 3)); // adaptive odd window
    const half = Math.floor(k / 2);

    const out = data.map((d, i) => {
      const a = Math.max(0, i - half);
      const b = Math.min(data.length - 1, i + half);
      const slice = data.slice(a, b + 1);

      const mean = slice.reduce((s, x) => s + x.score, 0) / slice.length;
      const variance =
        slice.reduce((s, x) => s + Math.pow(x.score - mean, 2), 0) /
        Math.max(1, slice.length - 1);
      const std = Math.sqrt(variance);

      return {
        ...d,
        mean,
        upper: Math.min(1, mean + 0.75 * std),
        lower: Math.max(-1, mean - 0.75 * std),
      };
    });

    return out;
  }, [segmentTimeline]);

  // 3) Per-minute stacked sentiment (bucket by minute)
  const perMinuteStack = useMemo(() => {
    const data = segmentTimeline;
    if (!data.length) return [];
    const m = new Map();

    for (const d of data) {
      const minute = Math.floor(d.t / 60);
      const key = minute;
      const row =
        m.get(key) || {
          minute,
          time: `${minute}m`,
          pos: 0,
          neu: 0,
          neg: 0,
          total: 0,
        };

      if (d.label === "positive") row.pos += 1;
      else if (d.label === "negative") row.neg += 1;
      else row.neu += 1;

      row.total += 1;
      m.set(key, row);
    }

    return Array.from(m.values())
      .sort((a, b) => a.minute - b.minute)
      .slice(0, 60); // keep readable
  }, [segmentTimeline]);

  // 4) Segment length histogram (chars)
  const lengthHistogram = useMemo(() => {
    const data = segmentTimeline;
    if (!data.length) return [];
    const lens = data.map((d) => d.chars);
    const max = Math.max(...lens, 1);

    const bins = 10;
    const step = Math.max(10, Math.ceil(max / bins));

    const counts = new Array(bins).fill(0);
    for (const L of lens) {
      const idx = Math.min(bins - 1, Math.floor(L / step));
      counts[idx] += 1;
    }

    return counts.map((c, i) => ({
      bucket: `${i * step}-${(i + 1) * step}`,
      count: c,
    }));
  }, [segmentTimeline]);

  // 5) Confidence grouped by sentiment label (avg)
  const confidenceByLabel = useMemo(() => {
    const data = segmentTimeline;
    if (!data.length) return [];

    const acc = {
      positive: { n: 0, sum: 0 },
      neutral: { n: 0, sum: 0 },
      negative: { n: 0, sum: 0 },
    };

    for (const d of data) {
      const k = d.label === "positive" ? "positive" : d.label === "negative" ? "negative" : "neutral";
      acc[k].n += 1;
      acc[k].sum += d.conf;
    }

    const mk = (k, name) => ({
      name,
      avg: acc[k].n ? acc[k].sum / acc[k].n : 0,
      n: acc[k].n,
    });

    return [mk("positive", "Positive"), mk("neutral", "Neutral"), mk("negative", "Negative")];
  }, [segmentTimeline]);

  /* ----------------------------- timers effects ----------------------------- */

  useEffect(() => {
    if (!loading) {
      setAnalysisElapsed(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => {
      const diffSec = Math.floor((Date.now() - started) / 1000);
      setAnalysisElapsed(diffSec);
    }, 500);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (!deepLoading) {
      setDeepElapsed(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => {
      const diffSec = Math.floor((Date.now() - started) / 1000);
      setDeepElapsed(diffSec);
    }, 500);
    return () => clearInterval(id);
  }, [deepLoading]);

  // Load last URL from storage / query param
  useEffect(() => {
    const u = localStorage.getItem("yt_last_url") || "";
    if (u) setUrl(u);
    try {
      const sp = new URLSearchParams(window.location.search);
      const qid = sp.get("yt");
      if (qid && !u) setUrl(`https://www.youtube.com/watch?v=${qid}`);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("yt_last_url", url);
  }, [url]);

  const fetchJsonWithRetry = useCallback(async (body, { tries = 2, timeoutMs = 25000 } = {}) => {
    let lastErr = null;
    for (let attempt = 0; attempt < tries; attempt++) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const r = await fetch(`${API_BASE}/stream/youtube/full`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(t);
        if (!r.ok) {
          let msg = `HTTP ${r.status}`;
          try {
            const j = await r.json();
            msg = j?.detail || JSON.stringify(j);
          } catch {
            msg = await r.text();
          }
          throw new Error(msg || `HTTP ${r.status}`);
        }
        return await r.json();
      } catch (e) {
        clearTimeout(t);
        lastErr = e;
        await new Promise((res) => setTimeout(res, 350 * (attempt + 1)));
      }
    }
    throw lastErr;
  }, []);

  const callApi = useCallback(async () => {
    if (!url || loading) return;
    setLoading(true);
    setError(null);
    setResp(null);
    setDeepResp(null);
    setDeepError(null);
    try {
      // ✅ KEEP API & payload EXACTLY SAME
      const data = await fetchJsonWithRetry(
        {
          url,
          yt_id: ytId || getYtId(url) || null,
          model: "onnx-optimized",
          window_seconds: 20,
          min_chars: 80,
          max_chars: 220,
          prefer_langs: ["bn", "en"],
          fetch_comments: false,
          rationale: false,
        },
        { tries: 2, timeoutMs: 25000 }
      );
      setResp(data);
      try {
        const sp = new URLSearchParams(window.location.search);
        if (getYtId(url)) {
          sp.set("yt", getYtId(url));
          window.history.replaceState({}, "", `?${sp.toString()}`);
        }
      } catch {}
    } catch (e) {
      setError(friendlyError(e.message || String(e)));
    } finally {
      setLoading(false);
    }
  }, [url, ytId, fetchJsonWithRetry, loading]);

  // Deep analysis on full transcript -> /analyze
  const runDeepAnalysis = useCallback(async () => {
    if (!transcript || deepLoading) return;
    setDeepLoading(true);
    setDeepError(null);
    try {
      // ✅ KEEP API & payload EXACTLY SAME
      const r = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: transcript,
          model: "onnx-optimized",
          narrative: true,
          explanation_lang: "auto",
          mode: "yt_deep",
        }),
      });
      if (!r.ok) {
        let msg = `HTTP ${r.status}`;
        try {
          const j = await r.json();
          msg = j?.detail || JSON.stringify(j);
        } catch {
          msg = await r.text();
        }
        throw new Error(msg || `HTTP ${r.status}`);
      }
      const j = await r.json();
      setDeepResp(j);
    } catch (e) {
      setDeepError(friendlyError(e.message || String(e)));
    } finally {
      setDeepLoading(false);
    }
  }, [transcript, deepLoading]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setUrl(t.trim());
    } catch {}
  }, []);

  return (
    <PageShell>
      <>
        <div className="mx-auto px-4 py-6 w-full max-w-[1600px]">
          {/* Title */}
          <div className="mb-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Streams</div>
            <h1 className="text-xl font-semibold text-slate-100">YouTube Sentiment</h1>
          </div>

          {/* Part 1: Input + Preview & Transcript */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            {/* Input + Preview */}
            <div className="h-full">
              <div className="h-full ring-1 ring-white/10 bg-slate-900/60 backdrop-blur p-5 flex flex-col rounded-xl">
                <div>
                  <label className="block text-sm font-medium text-slate-200">YouTube URL</label>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="flex-1 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2 outline-none focus:ring-2 focus:ring-slate-300 text-slate-100 placeholder:text-slate-500"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && url && !loading) callApi();
                      }}
                      aria-label="YouTube URL"
                    />
                    <button
                      onClick={callApi}
                      disabled={!url || loading}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 px-3 py-2 text-sm font-medium text-white shadow-sm transition"
                      title={loading ? "Running…" : "Analyze"}
                      aria-label="Analyze"
                    >
                      {loading ? (
                        <Spinner small label="…" />
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Analyze
                        </>
                      )}
                    </button>
                  </div>

                  <div className="mt-2 flex gap-2 text-xs">
                    <button
                      className="btn btn-ghost text-xs border border-transparent text-slate-400 hover:text-slate-100"
                      onClick={pasteFromClipboard}
                      title="Paste from clipboard"
                    >
                      Paste
                    </button>
                    <button
                      className="btn btn-ghost text-xs border border-transparent text-slate-400 hover:text-slate-100"
                      onClick={() => setUrl("https://www.youtube.com/watch?v=aqz-KE-bpKQ")}
                    >
                      Example
                    </button>
                  </div>

                  {error && (
                    <div className="mt-2 text-sm text-rose-300 flex items-start gap-2">
                      <ShieldAlert className="h-4 w-4 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="mt-3 text-xs text-slate-400 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    CC / timedtext first, then Whisper fallback. Windowed segments power the charts below.
                  </div>
                </div>

                <div className="mt-4 flex-1">
                  <div className="rounded-xl overflow-hidden h-full border border-slate-800/60 bg-black/80">
                    {ytId ? (
                      <div className="aspect-video bg-black">
                        <iframe
                          className="w-full h-full"
                          src={`https://www.youtube.com/embed/${ytId}?enablejsapi=1`}
                          title="YouTube video player"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          referrerPolicy="strict-origin-when-cross-origin"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <div className="text-sm text-slate-400 p-6">
                        Paste a valid YouTube URL and run analysis to see the preview here.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Transcript & Deep analysis */}
            <div className="h-full">
              <div className="h-full ring-1 ring-white/10 bg-slate-900/60 backdrop-blur p-4 flex flex-col rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-slate-400" />
                    <h2 className="font-medium text-slate-100">Extracted Text</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-ghost text-xs"
                      onClick={() => transcript && copyToClipboard(transcript)}
                      disabled={!transcript}
                      title="Copy transcript"
                    >
                      <Copy className="h-4 w-4 mr-1" /> Copy
                    </button>
                    <button
                      className="btn btn-ghost text-xs"
                      onClick={() => transcript && downloadTxt(`${ytId || "transcript"}.txt`, transcript)}
                      disabled={!transcript}
                      title="Download transcript"
                    >
                      <Download className="h-4 w-4 mr-1" /> Download
                    </button>
                    <button
                      className="btn btn-ghost text-xs"
                      onClick={runDeepAnalysis}
                      disabled={!transcript || deepLoading}
                      title="Run deep analysis on full transcript"
                    >
                      {deepLoading ? (
                        <Spinner small label="…" />
                      ) : (
                        <>
                          <FileText className="h-4 w-4 mr-1" />
                          Deep analysis
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {deepError && (
                  <div className="mt-2 text-xs text-amber-300 flex items-start gap-2">
                    <ShieldAlert className="h-3 w-3 mt-0.5" />
                    <span>{deepError}</span>
                  </div>
                )}

                <div className="mt-3 flex-1">
                  <textarea
                    readOnly
                    value={transcript}
                    placeholder="Run an analysis to see extracted text here…"
                    className="w-full h-full min-h-[320px] rounded-lg border border-slate-700 bg-slate-900/60 text-slate-100 p-3 resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Part 2: AI Analysis */}
          <section className="mt-6">
            <h2 className="text-[15px] font-semibold text-slate-100 mb-1">AI Analysis</h2>
            {deepResp && (
              <p className="text-[11px] text-slate-400 mb-2">
                Deep analysis has been run on the full transcript. Headline sentiment and the combined text below reflect that single-text view.
              </p>
            )}

            {!resp && (
              <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-6 text-slate-300">
                Paste a URL and click <b>Analyze</b>. You&apos;ll get windowed sentiment over time, and you can optionally run deep analysis on
                the full transcript for a single combined explanation block.
              </div>
            )}

            {resp && (
              <div className="space-y-4">
                {/* Headline stats */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Stat k="Overall Sentiment" v={headlineLabel || "—"} badge tone={headlineLabel ?? undefined} />
                  <Stat k="Score (Confidence)" v={`${Math.round(headlineConf * 1000) / 10}%`} progress={headlineConf} />
                  <Stat k="Polarity Score" v={totalSeg ? polarityScore.toFixed(3) : "—"} />
                  <Stat
                    k="Window / Langs"
                    v={`${resp?.params_used?.window_seconds ?? "—"}s • ${(resp?.params_used?.prefer_langs || []).join(", ") || "—"}`}
                  />
                </div>

                {/* NEW: 6 Unique YouTube visuals */}
                <div className="rounded-2xl ring-1 ring-white/10 bg-slate-900/60 backdrop-blur p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-100 font-semibold">YouTube Sentiment Visual Analytics</span>
                    <span className="text-[11px] px-2 py-0.5 rounded border border-slate-700 text-slate-300">
                      Segments: {totalSeg} • Video: {ytId || "—"}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-400 mt-1">
                    These charts are designed for video sentiment: time-based dynamics, stability, density, and confidence.
                  </p>

                  <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {/* 1) Score timeline */}
                    <VizCard title="Sentiment score over time" icon={Activity} subtitle="Per segment score (-1..1) across video time">
                      {segmentTimeline.length === 0 ? (
                        <EmptyViz />
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={segmentTimeline} margin={{ top: 10, right: 14, left: -4, bottom: 10 }}>
                            <defs>
                              <linearGradient id="lineGlow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgba(59,130,246,0.8)" />
                                <stop offset="100%" stopColor="rgba(59,130,246,0.25)" />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 3" />
                            <XAxis dataKey="tLabel" tick={{ fontSize: 10, fill: "#94a3b8" }} interval="preserveStartEnd" />
                            <YAxis domain={[-1, 1]} ticks={[-1, 0, 1]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                            <Tooltip
                              contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12 }}
                              labelStyle={{ color: "#e2e8f0" }}
                            />
                            <ReferenceLine y={0} stroke="rgba(148,163,184,0.35)" />
                            <Line
                              type="monotone"
                              dataKey="score"
                              name="Score"
                              stroke="url(#lineGlow)"
                              strokeWidth={2.6}
                              dot={{ r: 2.2, fill: "rgb(59,130,246)" }}
                              activeDot={{ r: 4.2 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </VizCard>

                    {/* 2) Rolling mean + band */}
                    <VizCard title="Rolling sentiment + volatility band" icon={Waves} subtitle="Smoothed mean with uncertainty band">
                      {rollingTimeline.length === 0 ? (
                        <EmptyViz />
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={rollingTimeline} margin={{ top: 10, right: 14, left: -4, bottom: 10 }}>
                            <defs>
                              <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgba(34,197,94,0.22)" />
                                <stop offset="100%" stopColor="rgba(34,197,94,0.05)" />
                              </linearGradient>
                              <linearGradient id="meanFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgba(56,189,248,0.25)" />
                                <stop offset="100%" stopColor="rgba(56,189,248,0.06)" />
                              </linearGradient>
                            </defs>

                            <CartesianGrid stroke="rgba(148,163,184,0.18)" strokeDasharray="3 3" />
                            <XAxis dataKey="tLabel" tick={{ fontSize: 10, fill: "#94a3b8" }} interval="preserveStartEnd" />
                            <YAxis domain={[-1, 1]} ticks={[-1, 0, 1]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                            <Tooltip
                              contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12 }}
                              labelStyle={{ color: "#e2e8f0" }}
                            />
                            <ReferenceLine y={0} stroke="rgba(148,163,184,0.35)" />

                            {/* band */}
                            <Area type="monotone" dataKey="upper" stroke="transparent" fill="transparent" />
                            <Area type="monotone" dataKey="lower" stroke="transparent" fill="transparent" />
                            {/* trick: draw band using stacked areas */}
                            <Area type="monotone" dataKey="upper" stroke="transparent" fill="url(#bandFill)" fillOpacity={1} />
                            <Area type="monotone" dataKey="lower" stroke="transparent" fill="rgba(0,0,0,0)" fillOpacity={0} />

                            {/* mean */}
                            <Area type="monotone" dataKey="mean" name="Mean" stroke="rgb(56,189,248)" strokeWidth={2.4} fill="url(#meanFill)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </VizCard>

                    {/* 3) Per-minute stacked */}
                    <VizCard title="Per-minute sentiment density" icon={Timer} subtitle="Stacked sentiment counts per minute">
                      {perMinuteStack.length === 0 ? (
                        <EmptyViz />
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={perMinuteStack} margin={{ top: 10, right: 14, left: -4, bottom: 10 }}>
                            <CartesianGrid stroke="rgba(148,163,184,0.16)" strokeDasharray="3 3" />
                            <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#94a3b8" }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12 }}
                              labelStyle={{ color: "#e2e8f0" }}
                            />
                            <Legend wrapperStyle={{ fontSize: 11, color: "#cbd5e1" }} />
                            <Bar dataKey="pos" name="Positive" stackId="a" fill="rgb(16,185,129)" radius={[10, 10, 0, 0]} />
                            <Bar dataKey="neu" name="Neutral" stackId="a" fill="rgb(100,116,139)" />
                            <Bar dataKey="neg" name="Negative" stackId="a" fill="rgb(244,63,94)" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </VizCard>

                    {/* 4) Donut */}
                    <VizCard title="Sentiment distribution" icon={PieIcon} subtitle="Positive / Neutral / Negative across all segments">
                      {totalSeg === 0 ? (
                        <EmptyViz />
                      ) : (
                        <div className="h-full flex items-center justify-center gap-6">
                          <Donut pos={pos} neu={neu} neg={neg} />
                          <div className="min-w-[170px] space-y-2">
                            <LegendRow color="rgb(16,185,129)" label="Positive" value={pos} />
                            <LegendRow color="rgb(100,116,139)" label="Neutral" value={neu} />
                            <LegendRow color="rgb(244,63,94)" label="Negative" value={neg} />
                            <div className="pt-3 mt-3 border-t border-slate-800/70 text-[11px] text-slate-400">
                              Tip: For long videos, density + rolling mean is the most useful pair.
                            </div>
                          </div>
                        </div>
                      )}
                    </VizCard>

                    {/* 5) Segment length histogram */}
                    <VizCard title="Segment text length histogram" icon={BarChart3} subtitle="Character-length distribution (readability + pace)">
                      {lengthHistogram.length === 0 ? (
                        <EmptyViz />
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={lengthHistogram} margin={{ top: 10, right: 14, left: -4, bottom: 10 }}>
                            <CartesianGrid stroke="rgba(148,163,184,0.16)" strokeDasharray="3 3" />
                            <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: "#94a3b8" }} interval={1} />
                            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12 }}
                              labelStyle={{ color: "#e2e8f0" }}
                            />
                            <Bar dataKey="count" name="Segments" fill="rgb(245,158,11)" radius={[10, 10, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </VizCard>

                    {/* 6) Confidence by sentiment */}
                    <VizCard title="Confidence by sentiment" icon={Activity} subtitle="Average confidence per label (when available)">
                      {confidenceByLabel.length === 0 ? (
                        <EmptyViz />
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={confidenceByLabel} margin={{ top: 10, right: 14, left: -4, bottom: 10 }}>
                            <CartesianGrid stroke="rgba(148,163,184,0.16)" strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                            <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                            <Tooltip
                              formatter={(v, k, p) => {
                                if (k === "avg") return [`${Math.round(v * 1000) / 10}%`, "Avg confidence"];
                                return [v, k];
                              }}
                              contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: 12 }}
                              labelStyle={{ color: "#e2e8f0" }}
                            />
                            <Bar
                              dataKey="avg"
                              name="Avg confidence"
                              fill="rgb(99,102,241)"
                              radius={[10, 10, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </VizCard>
                  </div>
                </div>

                {/* Combined single-text view: explanation AFTER charts */}
                {deepResp && (
                  <div className="rounded-xl ring-1 ring-white/10 bg-slate-900/70 backdrop-blur p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <h3 className="font-medium text-slate-100">Combined AI analysis (single text)</h3>
                      </div>
                      <button
                        className="btn btn-ghost text-xs"
                        disabled={!combinedSingleText}
                        onClick={() => combinedSingleText && copyToClipboard(combinedSingleText)}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Single block containing overall sentiment, optional summary and the LLM explanation — ideal for reports or notes.
                    </p>
                    <textarea
                      readOnly
                      value={combinedSingleText}
                      className="mt-3 w-full min-h-[160px] rounded-lg border border-slate-700 bg-slate-950/70 text-slate-100 text-sm p-3 resize-y"
                    />
                  </div>
                )}
              </div>
            )}
          </section>

          <div className="mt-6 text-xs opacity-60 text-center text-slate-400">
            © {new Date().getFullYear()} Sentilyzer • YouTube CC · Whisper · ONNXRuntime
          </div>
        </div>

        {/* Floating loading overlay ONLY over main content (not whole screen) */}
        {(loading || deepLoading) && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-md">
            <div className="rounded-2xl border border-sky-500/70 bg-slate-950/95 px-6 py-5 shadow-[0_32px_80px_rgba(8,47,73,0.95)] max-w-sm w-[90%] sm:w-auto">
              <div className="flex items-center gap-3 mb-3">
                <Spinner />
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
                    Running analysis
                  </span>
                  <span className="text-[12px] text-slate-400">
                    Processing video, extracting captions and computing sentiment…
                  </span>
                </div>
              </div>

              <div className="mt-1 space-y-1.5 text-[12px] text-slate-200">
                {loading && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-300">Video sentiment</span>
                    <span className="font-mono text-[11px] tabular-nums text-sky-200">
                      {fmtTime(analysisElapsed)}
                    </span>
                  </div>
                )}
                {deepLoading && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-300">Deep explanation</span>
                    <span className="font-mono text-[11px] tabular-nums text-emerald-200">
                      {fmtTime(deepElapsed)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    </PageShell>
  );
}
