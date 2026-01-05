// path: src/components/visualizations/TopWordsHeatmap.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";

/**
 * items = [{ token|word, delta|contribution, polarity? }]
 * Props:
 *  - items
 *  - maxItems?: number (default 150)
 *  - minAbs?: number
 *  - stopwords?: string[]
 *  - onTokenClick?: (token) => void
 *  - density?: "comfortable" | "dense"
 *  - neutralThresh?: number (default 0.002)
 *  - preferPolarity?: boolean (default true)
 *  - polarityOverrides?: Record<string,"positive"|"neutral"|"negative">
 */

const STOP_DEFAULT = [
  "the",
  "a",
  "an",
  "to",
  "and",
  "or",
  "is",
  "are",
  "am",
  "of",
  "in",
  "on",
  "for",
  "this",
  "that",
  "it",
  "its",
];
const EMOJI = { positive: "😊", neutral: "😐", negative: "😞" };

// sensible default overrides for obviously negative slurs/profanity; you can extend via prop
const DEFAULT_OVERRIDES = {
  fuck: "negative",
  fucking: "negative",
  shit: "negative",
  bastard: "negative",
  idiot: "negative",
  moron: "negative",
  stupid: "negative",
};

function normItem(it) {
  const rawToken = (it?.token ?? it?.word ?? "").toString();
  const token = rawToken
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, " ")
    .replace(/[^\p{L}\p{N}\-_' ]/gu, "");
  const delta = Number.isFinite(+it?.delta)
    ? +it.delta
    : Number.isFinite(+it?.contribution)
    ? +it.contribution
    : 0;
  const polarity = (it?.polarity || "").toString().toLowerCase(); // optional
  return { token: token || rawToken || "", delta, polarity };
}

function aggregate(items, minAbs, stopwords) {
  const stop = new Set(
    [...(stopwords || []), ...STOP_DEFAULT].map((s) =>
      s.toLowerCase(),
    ),
  );
  const map = new Map(); // token -> { delta, pos, neu, neg }
  for (const it of items) {
    const n = normItem(it);
    if (!n.token || stop.has(n.token)) continue;
    const prev = map.get(n.token) || {
      delta: 0,
      pos: 0,
      neu: 0,
      neg: 0,
    };
    prev.delta += n.delta;
    const p = n.polarity;
    if (p === "positive") prev.pos++;
    else if (p === "negative") prev.neg++;
    else if (p === "neutral") prev.neu++;
    map.set(n.token, prev);
  }
  let rows = Array.from(map, ([token, v]) => ({
    token,
    delta: v.delta,
    votes: v,
  }));
  if (minAbs > 0)
    rows = rows.filter((r) => Math.abs(r.delta) >= minAbs);
  return rows;
}

function colorFromValue(v, maxAbs) {
  const sign = v === 0 ? 0 : v > 0 ? 1 : -1;
  const t = Math.min(
    1,
    Math.abs(v) / Math.max(1e-9, maxAbs),
  );
  const g = Math.pow(t, 0.7);
  if (sign > 0)
    return `hsl(145, ${Math.round(45 + 30 * g)}%, ${Math.round(
      18 + 24 * g,
    )}%)`; // green
  if (sign < 0)
    return `hsl(350, ${Math.round(55 + 25 * g)}%, ${Math.round(
      18 + 24 * g,
    )}%)`; // red
  return `hsl(215, 14%, ${Math.round(
    24 + 10 * Math.min(1, t * 1.2),
  )}%)`; // slate
}

function fmt(v) {
  const a = Math.abs(v);
  if (a >= 0.01) return v.toFixed(2);
  if (a >= 0.001) return v.toFixed(3);
  return v.toExponential(1);
}

function inferPolarity(delta, neutralThresh) {
  if (Math.abs(delta) < neutralThresh) return "neutral";
  return delta > 0 ? "positive" : "negative";
}

export default function TopWordsHeatmap({
  items,
  maxItems = 150,
  minAbs = 0,
  stopwords,
  onTokenClick,
  density = "comfortable",
  neutralThresh = 0.002,
  preferPolarity = true,
  polarityOverrides,
}) {
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState("impact"); // impact|az|za
  const [polarityFilter, setPolarityFilter] =
    useState("all"); // all|positive|neutral|negative
  const [qHistory, setQHistory] = useState([]);
  const inputRef = useRef(null);

  const setQueryWithHistory = (next) => {
    setQHistory((h) => (next !== query ? [...h, query] : h));
    setQuery(next);
  };
  const goBack = () => {
    setQHistory((h) => {
      if (!h.length) {
        setQuery("");
        setPolarityFilter("all");
        return h;
      }
      const prev = h[h.length - 1];
      setQuery(prev);
      setPolarityFilter("all");
      return h.slice(0, -1);
    });
  };
  const resetAll = () => {
    setQuery("");
    setPolarityFilter("all");
    setSortMode("impact");
    setQHistory([]);
    inputRef.current?.focus();
  };

  const mergedOverrides = {
    ...DEFAULT_OVERRIDES,
    ...(polarityOverrides || {}),
  };

  const { rows, maxAbs } = useMemo(() => {
    const agg = aggregate(
      Array.isArray(items) ? items : [],
      minAbs,
      stopwords,
    );

    const enriched = agg.map((r) => {
      const { pos, neu, neg } = r.votes || {
        pos: 0,
        neu: 0,
        neg: 0,
      };

      // majority vote, else infer by delta
      let pol = "neutral";
      if (pos > neg && pos > neu) pol = "positive";
      else if (neg > pos && neg > neu) pol = "negative";
      else if (neu > pos && neu > neg) pol = "neutral";
      else pol = inferPolarity(r.delta, neutralThresh);

      // explicit overrides
      const override = mergedOverrides[r.token];
      if (
        override === "positive" ||
        override === "neutral" ||
        override === "negative"
      ) {
        pol = override;
      }

      // color/sort score
      const strength = Math.abs(r.delta);
      const score = preferPolarity
        ? pol === "positive"
          ? +strength
          : pol === "negative"
          ? -strength
          : 0
        : r.delta;

      return { token: r.token, delta: r.delta, polarity: pol, score };
    });

    // filter by query
    const q = query.trim().toLowerCase();
    let filtered = q
      ? enriched.filter((r) => r.token.includes(q))
      : enriched;

    // filter by polarity
    if (polarityFilter !== "all") {
      filtered = filtered.filter(
        (r) => r.polarity === polarityFilter,
      );
    }

    // sort
    let sorted;
    if (sortMode === "az")
      sorted = filtered.sort((a, b) =>
        a.token.localeCompare(b.token),
      );
    else if (sortMode === "za")
      sorted = filtered.sort((a, b) =>
        b.token.localeCompare(a.token),
      );
    else
      sorted = filtered.sort(
        (a, b) => Math.abs(b.score) - Math.abs(a.score),
      ); // impact by colored score

    const top = sorted.slice(0, maxItems);
    const m = Math.max(
      1e-9,
      ...top.map((x) => Math.abs(x.score)),
    );
    return { rows: top, maxAbs: m };
  }, [
    items,
    minAbs,
    stopwords,
    query,
    sortMode,
    maxItems,
    polarityFilter,
    neutralThresh,
    preferPolarity,
    mergedOverrides,
  ]);

  const total = rows.length;
  const pad = density === "dense" ? "px-2 py-1" : "px-3 py-2";
  const textCls =
    "text-[12px] sm:text-[13px] leading-tight text-slate-50";

  // Esc to reset
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") resetAll();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-100">
          Word Heatmap
        </div>
        <div className="text-[11px] text-slate-400">
          {total} tokens
        </div>
      </div>

      {/* Controls – fully responsive */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center text-[11px]">
        {/* Search */}
        <div className="w-full sm:flex-[1.8] relative">
          <input
            ref={inputRef}
            className="input input-sm w-full pr-7 bg-[#0f1424] border border-slate-700 text-slate-100 placeholder:text-slate-500"
            placeholder="Search token…"
            value={query}
            onChange={(e) =>
              setQueryWithHistory(e.target.value)
            }
          />
          {query && (
            <button
              type="button"
              aria-label="Clear"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
              onClick={() => setQueryWithHistory("")}
            >
              ×
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="w-full sm:w-auto sm:flex-[1]">
          <select
            className="select select-sm w-full bg-[#0f1424] border border-slate-700 text-slate-100"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            title="Sort"
          >
            <option value="impact">Sort by impact</option>
            <option value="az">A → Z</option>
            <option value="za">Z → A</option>
          </select>
        </div>

        {/* Polarity filter */}
        <div className="w-full sm:w-auto sm:flex-[1.1]">
          <select
            className="select select-sm w-full bg-[#0f1424] border border-slate-700 text-slate-100"
            value={polarityFilter}
            onChange={(e) =>
              setPolarityFilter(e.target.value)
            }
            title="Polarity"
          >
            <option value="all">All sentiments</option>
            <option value="positive">Positive only</option>
            <option value="neutral">Neutral only</option>
            <option value="negative">Negative only</option>
          </select>
        </div>

        {/* Density (read-only, compact on the right) */}
        <div className="w-full sm:w-auto sm:flex-[0.9]">
          <select
            className="select select-sm w-full bg-[#020617] border border-slate-800 text-slate-500"
            value={density}
            onChange={() => {}}
            disabled
            title="Density"
          >
            <option>Density: {density}</option>
          </select>
        </div>

        {/* Back & Reset */}
        <div className="w-full sm:w-auto sm:flex-[1.2] flex gap-2 justify-end sm:justify-start">
          <button
            type="button"
            className="btn btn-sm flex-1 sm:flex-none btn-ghost border border-slate-700/60 text-slate-100 hover:bg-slate-800/80 disabled:opacity-40"
            onClick={goBack}
            disabled={!qHistory.length && !query}
            title="Back to previous search"
          >
            Back
          </button>
          <button
            type="button"
            className="btn btn-sm flex-1 sm:flex-none btn-ghost text-slate-400 hover:text-slate-100 hover:bg-slate-800/80"
            onClick={resetAll}
            title="Reset all filters"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Results */}
      {total === 0 ? (
        <div className="rounded-md border border-slate-700/50 bg-slate-900/40 p-4 text-sm text-slate-200">
          No results for your current filters.
          <button
            className="ml-2 underline text-sky-300"
            onClick={resetAll}
          >
            Show all
          </button>
        </div>
      ) : (
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns:
              "repeat(auto-fill, minmax(min(140px, 100%), 1fr))",
          }}
        >
          {rows.map((r, i) => {
            const bg = colorFromValue(r.score, maxAbs);
            const sign =
              r.score > 0 ? "+" : r.score < 0 ? "−" : "";
            const title = `${r.token} • ${r.polarity} • ${sign}${fmt(
              Math.abs(r.score),
            )}`;
            return (
              <button
                key={`${r.token}-${i}`}
                type="button"
                title={title}
                onClick={() => onTokenClick?.(r.token)}
                className={`rounded-md border border-slate-700/60 text-left ${pad} ${textCls} hover:ring-1 hover:ring-white/10 transition w-full`}
                style={{ backgroundColor: bg }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate">
                    {r.token}
                  </div>
                  <span className="text-base leading-none select-none">
                    {EMOJI[r.polarity] || EMOJI.neutral}
                  </span>
                </div>
                <div className="text-[11px] opacity-90 text-slate-100/80 mt-0.5">
                  {r.polarity} • {sign}
                  {fmt(Math.abs(r.score))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        <Legend
          sw="bg-rose-500"
          label="Negative (stronger → deeper red)"
        />
        <Legend sw="bg-slate-500" label="Neutral" />
        <Legend
          sw="bg-emerald-500"
          label="Positive (stronger → deeper green)"
        />
      </div>
    </div>
  );
}

function Legend({ sw, label }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block w-3 h-3 rounded ${sw}`} />
      {label}
    </span>
  );
}
