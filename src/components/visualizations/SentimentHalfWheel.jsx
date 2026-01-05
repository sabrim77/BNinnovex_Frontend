// path: src/components/visualizations/SentimentHalfWheel.jsx
import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#4CAF50", "#606975", "#F44336"]; // Positive, Neutral, Negative
const GRADIENT_IDS = [
  "sentix-pos-grad",
  "sentix-neu-grad",
  "sentix-neg-grad",
];

const EMOJI_BY_SENTIMENT = {
  positive: "😊",
  neutral: "😐",
  negative: "😠",
};

export default function SentimentHalfWheel({
  sentiment = "neutral",
  distribution = { positive: 0, neutral: 1, negative: 0 },
}) {
  // Fixed order to align with COLORS
  const data = [
    {
      name: "Positive",
      key: "positive",
      value: Number(distribution?.positive ?? 0),
    },
    {
      name: "Neutral",
      key: "neutral",
      value: Number(distribution?.neutral ?? 0),
    },
    {
      name: "Negative",
      key: "negative",
      value: Number(distribution?.negative ?? 0),
    },
  ];

  const total = data.reduce(
    (s, d) => s + (isFinite(d.value) ? d.value : 0),
    0,
  );
  if (!isFinite(total) || total <= 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "1.25rem",
          fontSize: "0.95rem",
        }}
      >
        No sentiment data to visualize yet.
      </div>
    );
  }

  const pct = (v) => `${(v * 100).toFixed(1)}%`;
  const overall = (sentiment || "neutral").toLowerCase();
  const centerEmoji = EMOJI_BY_SENTIMENT[overall] ?? "😐";
  const centerLabel =
    overall.charAt(0).toUpperCase() + overall.slice(1);

  return (
    <>
      <style>{`
        /* Outer wrapper just centers the wheel inside its card */
        .sentix-sentiment-wrap {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
        }

        /* Wheel container scales with width, capped so it doesn't dominate */
        .sentix-wheel {
          width: 100%;
          max-width: 280px;
          aspect-ratio: 1 / 1; /* square; we only render the top half */
          position: relative;
        }

        /* Center label with emoji */
        .sentix-center {
          position: absolute;
          left: 50%;
          top: 58%;
          transform: translate(-50%, -50%);
          text-align: center;
          user-select: none;
          pointer-events: none;
        }
        .sentix-center .emoji {
          font-size: clamp(1.3rem, 2.6vw, 2rem);
          line-height: 1;
        }
        .sentix-center .label {
          font-size: clamp(0.9rem, 1.6vw, 1rem);
          opacity: 0.9;
          margin-top: 0.25rem;
        }
      `}</style>

      <div className="sentix-sentiment-wrap">
        {/* Half-wheel */}
        <div
          className="sentix-wheel"
          role="img"
          aria-label="Sentiment distribution half-wheel"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {/* Gradient defs for shaded arcs */}
              <defs>
                {COLORS.map((color, idx) => (
                  <linearGradient
                    key={GRADIENT_IDS[idx]}
                    id={GRADIENT_IDS[idx]}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={color}
                      stopOpacity={0.95}
                    />
                    <stop
                      offset="100%"
                      stopColor={color}
                      stopOpacity={0.6}
                    />
                  </linearGradient>
                ))}
              </defs>

              <Pie
                data={data}
                startAngle={180}
                endAngle={0}
                innerRadius="55%"   /* percentage keeps it responsive */
                outerRadius="88%"
                paddingAngle={4}
                dataKey="value"
                isAnimationActive
              >
                {data.map((entry, idx) => (
                  <Cell
                    key={entry.key}
                    fill={`url(#${GRADIENT_IDS[idx]})`}
                    stroke={COLORS[idx]}
                    strokeWidth={1}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => pct(value)}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  backgroundColor: "rgba(15,23,42,0.96)", // dark to match UI
                  border: "1px solid rgba(51,65,85,0.9)",
                  color: "#e5e7eb",
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Center label */}
          <div className="sentix-center" aria-hidden="true">
            <div className="emoji">{centerEmoji}</div>
            <div className="label">{centerLabel}</div>
          </div>
        </div>
      </div>
    </>
  );
}
