// path: src/components/visualizations/SentimentWeave.jsx
import React from "react";

const EMOJI = { positive: "😊", neutral: "😐", negative: "😞" };

const TEXT_COLORS = {
  positive: "text-emerald-300",
  neutral: "text-slate-200",
  negative: "text-rose-300",
};

const BADGE_COLORS = {
  positive:
    "bg-emerald-600/15 text-emerald-200 border-emerald-400/40",
  neutral:
    "bg-slate-600/20 text-slate-200 border-slate-400/40",
  negative:
    "bg-rose-600/15 text-rose-200 border-rose-400/40",
};

// Optional i18n (kept minimal to avoid duplicate labels)
const LABEL_I18N = {
  en: {
    positive: "positive",
    neutral: "neutral",
    negative: "negative",
  },
  bn: {
    positive: "ইতিবাচক",
    neutral: "নিরপেক্ষ",
    negative: "নেতিবাচক",
  },
  mix: {
    positive: "positive",
    neutral: "neutral",
    negative: "negative",
  },
  other: {
    positive: "positive",
    neutral: "neutral",
    negative: "negative",
  },
};

// Try to derive a confidence % per sentence.
// 1) use s.prob[s.sentiment] if provided
// 2) else map score ∈ [-1,1] → [0,100]
// 3) else undefined
function pctForSentence(s) {
  if (s && s.probs && typeof s.probs === "object") {
    const p = s.probs[s.sentiment];
    if (Number.isFinite(+p))
      return (
        Math.max(0, Math.min(1, +p)) * 100
      ).toFixed(1) + "%";
  }
  if (Number.isFinite(+s?.score)) {
    const v = Math.max(
      0,
      Math.min(1, (+s.score + 1) / 2), // -1..1 → 0..1
    );
    return (v * 100).toFixed(1) + "%";
  }
  return null;
}

export default function SentimentWeave({
  items, // [{ sentence, sentiment, score?, probs? }]
  detectedLang = "en", // "en" | "bn" | "mix" | "other"
  showPercent = true,
  compact = false, // tighter line-height
}) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    return (
      <div className="text-xs text-slate-500">
        No sentence-level data.
      </div>
    );
  }

  const lab = LABEL_I18N[detectedLang] || LABEL_I18N.en;
  const langLabel =
    detectedLang === "bn"
      ? "বাংলা"
      : detectedLang === "mix"
      ? "Banglish"
      : detectedLang === "en"
      ? "English"
      : "Other";

  // Small aggregated stats for header
  const counts = list.reduce(
    (acc, s) => {
      const k = String(s?.sentiment ?? "neutral").toLowerCase();
      if (k === "positive") acc.pos += 1;
      else if (k === "negative") acc.neg += 1;
      else acc.neu += 1;
      return acc;
    },
    { pos: 0, neu: 0, neg: 0 },
  );

  return (
    <div className="space-y-2">
      {/* Top row: tiny stats + language pill */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <span className="text-emerald-300 text-xs">
              {EMOJI.positive}
            </span>
            <span>{counts.pos} pos</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-slate-300 text-xs">
              {EMOJI.neutral}
            </span>
            <span>{counts.neu} neu</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-rose-300 text-xs">
              {EMOJI.negative}
            </span>
            <span>{counts.neg} neg</span>
          </span>
        </div>

        <span className="inline-flex items-center rounded-full border border-slate-600/70 bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-300">
          Lang: {langLabel}
        </span>
      </div>

      {/* Sentences list */}
      <div
        className={`space-y-1.5 ${
          compact ? "text-xs leading-5" : "text-sm leading-6"
        }`}
      >
        {list.map((s, i) => {
          const sentiment = String(
            s?.sentiment ?? "neutral",
          ).toLowerCase();
          const textCol =
            TEXT_COLORS[sentiment] || TEXT_COLORS.neutral;
          const badgeCol =
            BADGE_COLORS[sentiment] || BADGE_COLORS.neutral;
          const label = lab[sentiment] || sentiment;
          const perc = showPercent ? pctForSentence(s) : null;

          return (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2"
            >
              {/* Sentence + emoji */}
              <span
                className={`${textCol} sm:flex-1 min-w-0 whitespace-normal break-words`}
              >
                {s?.sentence || "—"}{" "}
                <span className="select-none">
                  {EMOJI[sentiment] || EMOJI.neutral}
                </span>
              </span>

              {/* Badge (right on desktop, below on mobile) */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${badgeCol} sm:ml-auto`}
                title={`Prediction: ${label}${
                  perc ? ` • ${perc}` : ""
                }`}
              >
                <span className="capitalize">{label}</span>
                {perc && (
                  <span className="opacity-80">· {perc}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
