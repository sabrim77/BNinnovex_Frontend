// path: src/pages/NormalAnalysis.jsx
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { API_BASE, getModels } from "../api.js";

// Layout & feedback
import Navbar from "../components/layout/Navbar.jsx";
import Sidebar from "../components/layout/Sidebar.jsx";
import ApiStatus from "../components/feedback/apiStatus.jsx";
import RightPaneError from "../components/feedback/RightPaneError.jsx";
import Spinner from "../components/feedback/Spinner.jsx";
import Toast from "../components/feedback/Toast.jsx";
import ErrorBoundary from "../components/dev/ErrorBoundary.jsx";

// Visualizations
import SentimentWeave from "../components/visualizations/SentimentWeave.jsx";
import SentimentHalfWheel from "../components/visualizations/SentimentHalfWheel.jsx";
import TopWords from "../components/visualizations/TopWords.jsx";

// Batch
import BatchDeepView from "../components/batch/batchDeepview.jsx";

// Icons
import {
  UploadCloud,
  Database,
  Sun,
  Moon,
  RotateCcw,
  Trash2,
} from "lucide-react";

/* small helper */
const cx = (...xs) => xs.filter(Boolean).join(" ");

/* time formatter (for floating timer pill) */
const fmtTime = (sec) => {
  if (sec == null || isNaN(sec)) return "00:00";
  const s = String(Math.floor(sec % 60)).padStart(2, "0");
  const m = String(Math.floor((sec / 60) % 60)).padStart(2, "0");
  const h = Math.floor(sec / 3600);
  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
};

/* =====================================================================
   NETWORK HELPERS (timeouts + retry)
   ===================================================================== */
async function jpostTimeout(path, body, timeoutMs, extSignal) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort("timeout"), timeoutMs);
  const onAbort = () => ctrl.abort("abort");
  if (extSignal) extSignal.addEventListener("abort", onAbort);
  try {
    const r = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(
        `HTTP ${r.status} ${r.statusText}${txt ? ` — ${txt}` : ""}`,
      );
    }
    return await r.json();
  } finally {
    clearTimeout(to);
    if (extSignal) extSignal.removeEventListener("abort", onAbort);
  }
}

async function postFormDataTimeout(path, formData, timeoutMs, extSignal) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort("timeout"), timeoutMs);
  const onAbort = () => ctrl.abort("abort");
  if (extSignal) extSignal.addEventListener("abort", onAbort);
  try {
    const r = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      body: formData,
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(
        `HTTP ${r.status} ${r.statusText}${txt ? ` — ${txt}` : ""}`,
      );
    }
    return await r.json();
  } finally {
    clearTimeout(to);
    if (extSignal) extSignal.removeEventListener("abort", onAbort);
  }
}

const predictFast = async (payload, ms = 3000, signal) => {
  try {
    return await jpostTimeout("/predict", payload, ms, signal);
  } catch (e) {
    const isTimeout =
      e && (e.name === "AbortError" || String(e).includes("timeout"));
    if (isTimeout) return jpostTimeout("/predict", payload, ms * 2, signal);
    throw e;
  }
};

const analyzeDeep = async (payload, ms = 12000, signal) => {
  try {
    return await jpostTimeout("/analyze", payload, ms, signal);
  } catch (e) {
    const isTimeout =
      e && (e.name === "AbortError" || String(e).includes("timeout"));
    if (isTimeout) return jpostTimeout("/analyze", payload, ms * 2, signal);
    throw e;
  }
};

const batchRun = async (file, modelsCsv = null, ms = 10000, signal) => {
  const fd = new FormData();
  fd.append("file", file);
  if (modelsCsv) fd.append("models", modelsCsv);
  try {
    return await postFormDataTimeout("/batch", fd, ms, signal);
  } catch (e) {
    const isTimeout =
      e && (e.name === "AbortError" || String(e).includes("timeout"));
    if (isTimeout) return postFormDataTimeout("/batch", fd, ms * 2, signal);
    throw e;
  }
};

/* =====================================================================
   UI HELPERS + HISTORY
   ===================================================================== */
function ThemeToggle({ dark, setDark }) {
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => setDark((d) => !d)}
      aria-label="Toggle theme"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

// text history (for "Reuse last" – still used internally if needed later)
const HISTORY_KEY = "sentix:history";
const readHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
};
const writeHistory = (arr) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(0, 10)));
  } catch {}
};
const pushHistory = (val) => {
  if (!val || !val.trim()) return;
  const cur = readHistory();
  if (cur[0] === val) return;
  writeHistory([val, ...cur.filter((t) => t !== val)]);
};

// analysis history (with scores)
const ANALYSIS_HISTORY_KEY = "sentix:analysisHistory";

const readAnalysisHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(ANALYSIS_HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
};
const writeAnalysisHistory = (arr) => {
  try {
    localStorage.setItem(
      ANALYSIS_HISTORY_KEY,
      JSON.stringify(arr.slice(0, 25)),
    );
  } catch {}
};
const pushAnalysisHistory = (entry) => {
  const base = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ts: Date.now(),
  };
  const cur = readAnalysisHistory();
  writeAnalysisHistory([{ ...base, ...entry }, ...cur]);
};

/* =====================================================================
   VISUAL COMPONENT PRIMITIVES
   ===================================================================== */
function SentimentPill({ label = "neutral" }) {
  const base =
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border";
  const map = {
    positive:
      "bg-emerald-500/10 text-emerald-300 border-emerald-500/40",
    negative:
      "bg-rose-500/10 text-rose-300 border-rose-500/40",
    neutral:
      "bg-slate-500/10 text-slate-300 border-slate-500/40",
  };
  const cls = map[label] || map.neutral;
  return (
    <span className={`${base} ${cls}`}>
      ● <span className="ml-1 capitalize">{label}</span>
    </span>
  );
}

function MetricChip({ label, value, subtle }) {
  return (
    <div
      className={cx(
        "px-2 py-1 rounded-lg text-[11px] flex items-center gap-1",
        subtle
          ? "bg-slate-900/70 text-slate-400 border border-slate-700/50"
          : "bg-slate-800/80 text-slate-100 border border-slate-600/60",
      )}
    >
      <span className="uppercase tracking-wide opacity-80">
        {label}
      </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function SectionCard({ title, description, children }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">
          {title}
        </h3>
        {description && (
          <p className="mt-0.5 text-[11px] text-slate-400">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

/* =====================================================================
   SAFE RESULT WRAPPERS
   ===================================================================== */
function SingleVizSafe({ result, note }) {
  const safe = result || {
    overall_sentiment: "neutral",
    confidence: 0,
    distribution: { negative: 0, neutral: 1, positive: 0 },
  };

  const { negative = 0, neutral = 0, positive = 0 } =
    safe.distribution || {};
  const confPct = `${Math.round((safe.confidence || 0) * 100)}%`;

  return (
    <div className="space-y-4">
      <SectionCard
        title="Overall sentiment"
        description="Deep analysis fallback prediction"
      >
        {/* Top row: sentiment + confidence */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SentimentPill label={safe.overall_sentiment} />
            <MetricChip label="Confidence" value={confPct} />
          </div>
          <MetricChip label="Mode" value="Auto" subtle />
        </div>

        {/* Middle: main wheel + distribution chips */}
        <div className="mt-3 flex flex-col lg:flex-row lg:items-center lg:gap-6 gap-3">
          <div className="flex-1 min-w-[180px]">
            <SentimentHalfWheel
              sentiment={safe.overall_sentiment}
              distribution={safe.distribution}
            />
          </div>

          <div className="flex-1 grid grid-cols-3 gap-2 text-[11px]">
            <MetricChip
              label="Negative"
              value={`${Math.round(negative * 100)}%`}
              subtle
            />
            <MetricChip
              label="Neutral"
              value={`${Math.round(neutral * 100)}%`}
              subtle
            />
            <MetricChip
              label="Positive"
              value={`${Math.round(positive * 100)}%`}
              subtle
            />
          </div>
        </div>

        {/* Note / fallback info */}
        {note && (
          <div className="mt-2 text-[11px] text-slate-400">
            {note}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function DeepVizSafe({ result }) {
  const r = result || {};
  const dist = r.distribution || {
    negative: 0,
    neutral: 1,
    positive: 0,
  };
  const words = Array.isArray(r.word_attributions)
    ? r.word_attributions
    : [];
  const sentences = Array.isArray(r.sentence_sentiments)
    ? r.sentence_sentiments
    : [];

  const { negative = 0, neutral = 0, positive = 0 } = dist;
  const confPct = `${Math.round((r.confidence || 0) * 100)}%`;

  return (
    <div className="space-y-5">
      {/* 1) Narrative / rationale */}
      {(r.explanation || r.narrative) && (
        <SectionCard
          title="Model rationale"
          description="Why the model thinks the text is positive, neutral, or negative"
        >
          <p className="text-sm text-slate-100 leading-relaxed">
            {r.explanation || r.narrative}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <SentimentPill label={r.overall_sentiment || "neutral"} />
            <MetricChip label="Confidence" value={confPct} subtle />
            {r.model && (
              <MetricChip label="Model" value={r.model} subtle />
            )}
            {r.explanation_model && (
              <MetricChip
                label="Rationale model"
                value={r.explanation_model}
                subtle
              />
            )}
          </div>
        </SectionCard>
      )}

      {/* 2) Flow + distribution side by side */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)]">
        <SectionCard
          title="Sentence-level flow"
          description="How tone changes across the text"
        >
          {sentences.length === 0 ? (
            <div className="text-xs text-slate-500">
              No sentence-level breakdown available for this text.
            </div>
          ) : (
            <SentimentWeave items={sentences} />
          )}
        </SectionCard>

        <SectionCard
          title="Overall distribution"
          description="Share of each sentiment"
        >
          <div className="flex flex-col gap-3">
            <div className="max-w-xs">
              <SentimentHalfWheel
                sentiment={r.overall_sentiment || "neutral"}
                distribution={dist}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <MetricChip
                label="Negative"
                value={`${Math.round(negative * 100)}%`}
                subtle
              />
              <MetricChip
                label="Neutral"
                value={`${Math.round(neutral * 100)}%`}
                subtle
              />
              <MetricChip
                label="Positive"
                value={`${Math.round(positive * 100)}%`}
                subtle
              />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* 3) Token attributions */}
      <SectionCard
        title="Top tokens"
        description="Words that influenced the prediction the most"
      >
        {words.length === 0 ? (
          <div className="text-xs text-slate-500">
            No token-level attribution available.
          </div>
        ) : (
          <TopWords items={words} />
        )}
      </SectionCard>
    </div>
  );
}

/* =====================================================================
   ANALYSIS HISTORY CARD
   ===================================================================== */
function HistoryCard({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="card ring-1 ring-white/10 bg-slate-900/70 backdrop-blur">
        <div className="font-semibold text-slate-100 mb-2">
          History
        </div>
        <div className="text-xs text-slate-500 mb-3">
          No analyses recorded yet. Run a deep analysis to populate
          history.
        </div>
      </div>
    );
  }

  return (
    <div className="card ring-1 ring-white/10 bg-slate-900/70 backdrop-blur">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-slate-100">History</div>
        <div className="text-[11px] text-slate-500">
          {items.length} run{items.length > 1 ? "s" : ""}
        </div>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {items.map((h) => {
          const res = h.result || {};
          const dist = res.distribution || {
            negative: 0,
            neutral: 1,
            positive: 0,
          };
          const conf = Math.round((res.confidence || 0) * 100);
          const neg = Math.round((dist.negative || 0) * 100);
          const neu = Math.round((dist.neutral || 0) * 100);
          const pos = Math.round((dist.positive || 0) * 100);
          const preview = h.text
            ? h.text.length > 80
              ? h.text.slice(0, 80) + "…"
              : h.text
            : h.fileName || "(batch)";
          const ts = new Date(h.ts);
          const stamp = `${ts.toLocaleDateString()} ${ts.toLocaleTimeString(
            [],
            { hour: "2-digit", minute: "2-digit" },
          )}`;

          return (
            <div
              key={h.id}
              className="rounded-lg border border-slate-700/60 bg-[#0f1424] px-3 py-2 text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SentimentPill label={res.overall_sentiment || "neutral"} />
                  <MetricChip
                    label="Conf"
                    value={isNaN(conf) ? "–" : `${conf}%`}
                    subtle
                  />
                </div>
                <div className="text-[10px] text-slate-500 text-right">
                  <div className="capitalize">{h.mode}</div>
                  <div>{stamp}</div>
                </div>
              </div>
              <div className="text-slate-200">
                {preview || "(no text preview)"}
              </div>
              <div className="flex flex-wrap gap-1 mt-1 text-[10px] text-slate-400">
                <span>Neg {isNaN(neg) ? "–" : `${neg}%`}</span>
                <span>· Neu {isNaN(neu) ? "–" : `${neu}%`}</span>
                <span>· Pos {isNaN(pos) ? "–" : `${pos}%`}</span>
                {h.model && <span>· {h.model}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =====================================================================
   SHARED LAYOUT SHELL
   ===================================================================== */
const RAIL_STORAGE_KEY = "railCollapsed";

function PageShell({ children }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(RAIL_STORAGE_KEY) ?? "false");
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        RAIL_STORAGE_KEY,
        JSON.stringify(collapsed),
      );
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

/* =====================================================================
   MAIN PAGE (Deep-only Analysis)
   ===================================================================== */
export default function NormalAnalysis() {
  const [scopedDark, setScopedDark] = useState(true);

  // models (still used internally, but not shown on UI)
  const [models, setModels] = useState({
    default: "onnx-optimized",
    available: [],
  });
  const [selectedModel, setSelectedModel] = useState("onnx-optimized");

  // inputs
  const [text, setText] = useState(
    () => localStorage.getItem("sentix:lastText") || "",
  );
  const [file, setFile] = useState(null);
  const fileRef = useRef(null);
  const dropRef = useRef(null);

  // right-panel / results state
  const [csvPreview, setCsvPreview] = useState([]); // (optional small usage)
  const [rightNote, setRightNote] = useState("");
  const [rightError, setRightError] = useState("");
  const [toast, setToast] = useState(null);

  // results
  const [singleFast, setSingleFast] = useState(null); // fallback fast prediction
  const [singleDeep, setSingleDeep] = useState(null);
  const [batchDeepView, setBatchDeepView] = useState(null);
  const [batchDeepPick, setBatchDeepPick] = useState(null);

  const [loading, setLoading] = useState(false);

  // history UI
  const [analysisHistory, setAnalysisHistory] = useState(() =>
    readAnalysisHistory(),
  );

  // timers (for floating pill)
  const [analysisElapsed, setAnalysisElapsed] = useState(0);

  // inflight request abort controller
  const inFlightCtrl = useRef(null);

  const hasResults = !!(
    singleFast ||
    singleDeep ||
    batchDeepView ||
    batchDeepPick
  );
  const hasAnyInput = !!(file || text.trim());

  /* -------- init -------- */
  useEffect(() => {
    getModels()
      .then((m) => {
        setModels(
          m || {
            default: "onnx-optimized",
            available: [],
          },
        );
        setSelectedModel(m?.default || "onnx-optimized");
      })
      .catch(() => {});
  }, []);

  // warm-up (idle)
  useEffect(() => {
    const run = () => {
      jpostTimeout(
        "/benchmark",
        { text: "warmup", model: "onnx-optimized" },
        4000,
      ).catch(() => {});
      jpostTimeout(
        "/predict",
        { text: "warmup", narrative: false },
        3000,
      ).catch(() => {});
    };
    if ("requestIdleCallback" in window)
      window.requestIdleCallback(run);
    else setTimeout(run, 600);
  }, []);

  // persist text
  useEffect(() => {
    const id = setTimeout(
      () => localStorage.setItem("sentix:lastText", text),
      300,
    );
    return () => clearTimeout(id);
  }, [text]);

  // drag & drop
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const prevent = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onDrop = (e) => {
      prevent(e);
      const f = e.dataTransfer?.files?.[0];
      if (f) {
        const ok = /\.(csv|xlsx?|XLSX?)$/i.test(f.name);
        if (!ok) {
          setToast({
            type: "error",
            title: "Unsupported file",
            msg: "Please upload CSV/XLSX",
          });
          return;
        }
        setText("");
        setFile(f);
        setToast({
          type: "ok",
          title: "File attached",
          msg: f.name,
        });
      }
    };
    ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) =>
      el.addEventListener(ev, prevent),
    );
    el.addEventListener("drop", onDrop);
    return () => {
      ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) =>
        el.removeEventListener(ev, prevent),
      );
      el.removeEventListener("drop", onDrop);
    };
  }, []);

  // CSV preview (optional small usage)
  useEffect(() => {
    setCsvPreview([]);
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = () => {
        const t = reader.result?.toString() || "";
        setCsvPreview(t.split(/\r?\n/).slice(0, 6));
      };
      reader.readAsText(file);
    } else {
      setCsvPreview([`File: ${file.name}`]);
    }
  }, [file]);

  // floating timer effect
  useEffect(() => {
    if (!loading) {
      setAnalysisElapsed(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      const diffSec = Math.floor((Date.now() - start) / 1000);
      setAnalysisElapsed(diffSec);
    }, 500);
    return () => clearInterval(id);
  }, [loading]);

  const clearResults = () => {
    setSingleFast(null);
    setSingleDeep(null);
    setBatchDeepView(null);
    setBatchDeepPick(null);
    setRightError("");
    setRightNote("");
  };
  const clearFile = () => {
    setFile(null);
    setCsvPreview([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const reuseLast = () => {
    const h = readHistory();
    if (h.length > 0) setText(h[0]);
  };
  const resetUI = () => {
    setText("");
    clearFile();
    clearResults();
    localStorage.removeItem("sentix:lastText");
    // keep existing analysis history
    setAnalysisHistory(readAnalysisHistory());
  };

  const clearHistory = () => {
    writeAnalysisHistory([]);
    setAnalysisHistory([]);
    setToast({
      type: "ok",
      title: "History cleared",
    });
  };

  const beginRequest = () => {
    if (inFlightCtrl.current) {
      try {
        inFlightCtrl.current.abort("re-run");
      } catch {}
    }
    inFlightCtrl.current = new AbortController();
    return inFlightCtrl.current.signal;
  };
  useEffect(
    () => () => {
      if (inFlightCtrl.current) {
        try {
          inFlightCtrl.current.abort("teardown");
        } catch {}
      }
    },
    [],
  );

  const loadSample = () => {
    const sample =
      "I love the camera quality, but the battery drains fast. Support was helpful though.";
    setText(sample);
    if (file) clearFile();
  };

  /* -------- actions (deep-only) -------- */
  const runDeep = useCallback(async () => {
    if (loading) return;
    const signal = beginRequest();
    setLoading(true);
    clearResults();
    try {
      if (file) {
        setToast({
          type: "ok",
          title: "Batch deep",
          msg: "Overview + per-row details",
        });
        const out = await batchRun(file, null, 7000, signal);
        setBatchDeepView(out);
        setRightNote(
          "Expand any row for per-model probabilities, or click 'Analyze row' for tokens/sentences/rationale.",
        );

        const res = out?.summary || out?.aggregate || null;
        if (res) {
          pushAnalysisHistory({
            mode: "batch",
            text: null,
            fileName: file.name,
            model: selectedModel,
            result: res,
          });
          setAnalysisHistory(readAnalysisHistory());
        }
      } else if (text.trim()) {
        pushHistory(text);
        setSingleDeep({
          overall_sentiment: "neutral",
          confidence: 0.0,
          distribution: {
            negative: 0.0,
            neutral: 1.0,
            positive: 0.0,
          },
          word_attributions: [],
          sentence_sentiments: [],
          explanation: "Analyzing…",
          explanation_model: "loading",
          model: selectedModel,
        });
        try {
          const deep = await analyzeDeep(
            { text, model: selectedModel },
            7000,
            signal,
          );
          setSingleDeep(deep);

          pushAnalysisHistory({
            mode: "single",
            text,
            fileName: null,
            model: selectedModel,
            result: deep,
          });
          setAnalysisHistory(readAnalysisHistory());
        } catch (err) {
          const fb = await predictFast(
            { text, model: selectedModel, narrative: false },
            3000,
            signal,
          );
          setSingleDeep(null);
          setSingleFast(fb);
          setRightNote(
            "Deep analysis timed out — showing fast prediction.",
          );

          pushAnalysisHistory({
            mode: "single-fast",
            text,
            fileName: null,
            model: selectedModel,
            result: fb,
          });
          setAnalysisHistory(readAnalysisHistory());
        }
      } else {
        setRightError("Please enter text or choose a CSV/XLSX.");
      }
    } catch (e) {
      const msg =
        (e && (e.message || e.toString())) || "Failed.";
      setRightError(
        msg.includes("AbortError")
          ? "Deep analysis canceled or timed out. Try again."
          : msg,
      );
      setToast({
        type: "error",
        title: "Deep analysis failed",
        msg,
      });
    } finally {
      setLoading(false);
    }
  }, [file, text, selectedModel, loading]);

  const onPickRowForDeep = async (rowText) => {
    const signal = beginRequest();
    setLoading(true);
    setRightError("");
    setRightNote("");
    try {
      const out = await analyzeDeep(
        { text: rowText, model: selectedModel },
        7000,
        signal,
      );
      setBatchDeepPick(out);

      pushAnalysisHistory({
        mode: "batch-row",
        text: rowText,
        fileName: null,
        model: selectedModel,
        result: out,
      });
      setAnalysisHistory(readAnalysisHistory());
    } catch (e) {
      const msg =
        (e && (e.message || e.toString())) || "Failed.";
      setRightError(
        msg.includes("AbortError")
          ? "Per-row deep analysis canceled or timed out—try again or pick a shorter row."
          : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  const runBatchDeepAll = useCallback(async () => {
    const data = batchDeepView;
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    if (!rows.length) {
      setRightError("Run Deep Analysis on a file first.");
      return;
    }
    const signal = beginRequest();
    setLoading(true);
    setRightNote("Running deep analysis on the whole batch…");
    try {
      const texts = rows
        .map((r) => String(r.text || "").trim())
        .filter(Boolean);
      const limit = 3;
      let idx = 0;
      const results = [];
      async function worker() {
        while (idx < texts.length) {
          const myIndex = idx++;
          try {
            results[myIndex] = await analyzeDeep(
              { text: texts[myIndex], model: selectedModel },
              7000,
              signal,
            );
          } catch (e) {
            results[myIndex] = {
              error: String(e),
              text: texts[myIndex],
            };
          }
        }
      }
      await Promise.all(
        Array.from(
          { length: Math.min(limit, texts.length) },
          () => worker(),
        ),
      );
      setBatchDeepPick(null);
      setSingleDeep(null);
      setSingleFast(null);
      setBatchDeepView({ ...data, deep_results: results });
      setRightNote(
        "Batch deep complete. Expand rows or inspect deep_results.",
      );

      const summary = data?.summary || data?.aggregate || null;
      if (summary) {
        pushAnalysisHistory({
          mode: "batch-all",
          text: null,
          fileName: "(batch deep all)",
          model: selectedModel,
          result: summary,
        });
        setAnalysisHistory(readAnalysisHistory());
      }
    } finally {
      setLoading(false);
    }
  }, [batchDeepView, selectedModel]);

  /* -------- render -------- */
  return (
    <PageShell>
      {/* SCOPED black theme container */}
      <div
        className={cx(
          scopedDark ? "dark" : "",
          "min-h-full relative overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-950/70 backdrop-blur",
        )}
        style={{ color: "#e5e7eb" }}
      >
        {/* soft aurora blobs */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-40 -left-40 h-[420px] w-[420px] rounded-full blur-3xl opacity-25
                        bg-gradient-to-br from-indigo-600/20 via-fuchsia-600/20 to-emerald-600/20"
          />
          <div
            className="absolute -bottom-48 -right-48 h-[520px] w-[520px] rounded-full blur-3xl opacity-25
                        bg-gradient-to-tr from-teal-600/20 via-cyan-600/20 to-violet-600/20"
          />
        </div>

        {/* Small in-page header */}
        <div className="relative z-10 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur">
          <div className="px-3 sm:px-4 lg:px-6 py-2 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                Deep Input
              </div>
              <h1 className="text-sm sm:text-base font-semibold text-slate-100">
                Single &amp; Batch Deep Analysis
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <ApiStatus />
              <ThemeToggle dark={scopedDark} setDark={setScopedDark} />
            </div>
          </div>
        </div>

        {/* Base content: input (smaller) + results (larger) + history under input */}
        <div className="relative z-10 flex-1 overflow-y-auto">
          <div className="px-3 sm:px-4 lg:px-6 pt-4 pb-6 space-y-4">
            {/* Input + results grid (input small, results large) */}
            <div className="grid items-start gap-y-3 gap-x-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
              {/* Left: Input + History */}
              <div className="flex flex-col gap-3">
                {/* Input card */}
                <div
                  ref={dropRef}
                  className="card p-4 md:p-5 shadow-xl/10 ring-1 ring-white/10
                             bg-slate-900/70 backdrop-blur supports-[backdrop-filter]:bg-slate-900/60"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold text-slate-100">
                      Input
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Reset UI */}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={resetUI}
                        title="Reset input & results"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      {/* Clear analysis history */}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={clearHistory}
                        title="Delete analysis history"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {loading && <Spinner small label="Processing" />}
                    </div>
                  </div>

                  <label className="sr-only" htmlFor="text-input">
                    Single-text input
                  </label>
                  <textarea
                    id="text-input"
                    className="textarea flex-1 bg-[#0f1424] text-slate-100 border-slate-700"
                    placeholder="Type or paste text for deep analysis…"
                    value={text}
                    onChange={(e) => {
                      if (file) clearFile();
                      setText(e.target.value);
                    }}
                    disabled={!!file}
                    rows={8}
                  />
                  {!file && text && (
                    <div className="text-xs text-slate-400 mt-1">
                      File input is disabled while text is present.
                    </div>
                  )}

                  <div className="my-3 text-center text-xs text-slate-500">
                    — OR —
                  </div>

                  <div>
                    <label className="block text-sm text-slate-300 mb-1">
                      Upload CSV/XLSX (must contain a <b>text</b> column)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          if (!f) return setFile(null);
                          const ok =
                            /\.(csv|xlsx?|XLSX?)$/i.test(f.name);
                          if (!ok) {
                            setToast({
                              type: "error",
                              title: "Unsupported file",
                              msg: "Please upload CSV/XLSX",
                            });
                            e.target.value = "";
                            return;
                          }
                          setText("");
                          setFile(f);
                        }}
                        className="w-full file:mr-2"
                        disabled={!!text.trim()}
                      />
                      <button
                        className="btn"
                        onClick={() => fileRef.current?.click()}
                        title="Pick a file"
                        type="button"
                      >
                        <UploadCloud className="h-4 w-4" />
                      </button>
                    </div>

                    {file && (
                      <>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                          <span className="text-slate-400">
                            Selected:
                          </span>
                          <span className="text-slate-200">
                            {file.name}
                          </span>
                          <button
                            className="btn"
                            type="button"
                            onClick={() => {
                              clearFile();
                              setToast({
                                type: "ok",
                                title: "Cleared file",
                              });
                            }}
                          >
                            Clear
                          </button>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Text input is disabled while a file is attached.
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      className="btn btn-primary"
                      onClick={runDeep}
                      disabled={loading || !hasAnyInput}
                      type="button"
                    >
                      <Database className="h-4 w-4" /> Deep Analysis
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={loadSample}
                    >
                      Load sample
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={reuseLast}
                    >
                      Reuse last
                    </button>
                  </div>
                </div>

                {/* History under input */}
                <HistoryCard items={analysisHistory} />
              </div>

              {/* Right: Results (larger, fixed place with internal scroll) */}
              <div className="h-full">
                <div
                  className="card p-4 md:p-5 shadow-xl/10 ring-1 ring-white/10
                             bg-slate-900/70 backdrop-blur supports-[backdrop-filter]:bg-slate-900/60
                             h-full max-h-[calc(100vh-220px)] flex flex-col"
                  aria-live="polite"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold text-slate-100">
                      {file ? "Batch analysis" : "Single text analysis"}
                    </div>
                    <span className="badge">
                      {file ? "Batch (CSV/XLSX)" : "Single text"}
                    </span>
                  </div>

                  {/* Error (fixed at top) */}
                  {rightError && (
                    <div className="mt-2">
                      <RightPaneError detail={rightError} />
                    </div>
                  )}

                  {/* Scrollable content area */}
                  <div className="mt-3 flex-1 overflow-y-auto pr-1">
                    {!rightError && !hasResults && (
                      <div className="text-sm text-slate-400">
                        Run <b>Deep Analysis</b> to see detailed sentiment
                        distribution, rationale, and token / sentence-level
                        insights for{" "}
                        {file ? "your uploaded file rows." : "this single text."}
                      </div>
                    )}

                    {!rightError && hasResults && (
                      <div className="space-y-4">
                        {batchDeepPick ? (
                          <DeepVizSafe result={batchDeepPick} />
                        ) : singleDeep ? (
                          <DeepVizSafe result={singleDeep} />
                        ) : singleFast ? (
                          <SingleVizSafe
                            result={singleFast}
                            note={rightNote}
                          />
                        ) : batchDeepView ? (
                          <>
                            <div className="flex justify-end mb-2">
                              <button
                                className="btn btn-secondary btn-sm"
                                type="button"
                                onClick={runBatchDeepAll}
                                disabled={
                                  loading ||
                                  !Array.isArray(batchDeepView?.rows)
                                }
                              >
                                Deep all
                              </button>
                            </div>
                            <BatchDeepView
                              data={batchDeepView}
                              onAnalyzeRow={onPickRowForDeep}
                            />
                          </>
                        ) : null}

                        {rightNote && (
                          <div className="text-xs text-slate-400">
                            {rightNote}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 text-xs text-slate-500 text-center">
              © {new Date().getFullYear()} Sentilyzer • FastAPI ·
              ONNXRuntime · React
            </div>
          </div>
        </div>

        {/* Floating timer pill (non-blocking) */}
        {loading && (
          <button
            type="button"
            className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-sky-500/70 bg-slate-950/95 px-4 py-2 text-[11px] font-medium text-slate-100 shadow-[0_20px_60px_rgba(8,47,73,0.95)]"
          >
            <Spinner small />
            <span>Analyzing…</span>
            <span className="font-mono tabular-nums text-sky-200">
              {fmtTime(analysisElapsed)}
            </span>
          </button>
        )}

        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    </PageShell>
  );
}
