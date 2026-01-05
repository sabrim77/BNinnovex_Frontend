// path: src/components/batch/BatchDeepView.jsx
import React from "react";
import {
  BarChart2,
  FileText,
  Layers,
  Timer,
  TrendingUp,
  GitBranch,
  Gauge,
  Globe,
  Download,
} from "lucide-react";

/* ---------- tiny helpers ---------- */
const pct = (v) => `${(Number(v || 0) * 100).toFixed(1)}%`;
const clamp = (s, n = 140) =>
  !s ? "" : s.length > n ? s.slice(0, n) + "…" : s;
const safeNum = (x, d = 0) => (isFinite(x) ? Number(x).toFixed(d) : "0");
const to01 = (v) => {
  const x = Number(v);
  if (!isFinite(x)) return 0;
  if (x > 1) return Math.max(0, Math.min(1, x / 100));
  return Math.max(0, Math.min(1, x));
};
const toPct = (v, d = 0) => `${(to01(v) * 100).toFixed(d)}%`;
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
const normLabel = (s) => (s || "").toString().trim().toLowerCase();

/* UI atoms */
function StatTile({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-600/20 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-800/40 p-4 shadow">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 grid place-items-center rounded-lg bg-slate-700/40 border border-slate-600/30">
          <Icon className="h-5 w-5 text-emerald-300" />
        </div>
        <div>
          <div className="text-[11px] uppercase opacity-70">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
          {sub && <div className="text-[11px] opacity-60 mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function Bar({ pct = 0, hue = "emerald" }) {
  const safe = Math.max(0, Math.min(100, Math.round(pct)));
  const bg =
    hue === "rose"
      ? "from-rose-400 to-rose-500"
      : hue === "amber"
      ? "from-amber-400 to-amber-500"
      : "from-emerald-400 to-emerald-500";

  return (
    <div className="w-full h-2 rounded-full bg-slate-600/20 overflow-hidden">
      <div className={`h-full bg-gradient-to-r ${bg}`} style={{ width: `${safe}%` }} />
    </div>
  );
}

/* compute model agreement */
function computeAgreementMatrix(rows) {
  const models = new Set();
  rows.forEach((r) => Object.keys(r?.per_model || {}).forEach((m) => models.add(m)));

  const list = Array.from(models);
  const N = list.length;
  const agree = Array.from({ length: N }, () => Array(N).fill(0));
  const total = Array.from({ length: N }, () => Array(N).fill(0));

  rows.forEach((r) => {
    const per = r?.per_model || {};
    for (let i = 0; i < N; i++) {
      for (let j = i; j < N; j++) {
        const li = per[list[i]]?.label;
        const lj = per[list[j]]?.label;
        if (li != null && lj != null) {
          total[i][j]++;
          total[j][i]++;
          if (li === lj) {
            agree[i][j]++;
            agree[j][i]++;
          }
        }
      }
    }
  });

  const pctMat = agree.map((row, i) =>
    row.map((v, j) => (total[i][j] ? v / total[i][j] : 0)),
  );

  return { models: list, pctMat };
}

/* avg class confidence */
function computeAvgConf(rows) {
  const acc = {};
  rows.forEach((r) => {
    Object.entries(r?.per_model || {}).forEach(([m, v]) => {
      const probs = v?.probs || {};
      if (!acc[m])
        acc[m] = {
          negative: { sum: 0, n: 0 },
          neutral: { sum: 0, n: 0 },
          positive: { sum: 0, n: 0 },
        };
      ["negative", "neutral", "positive"].forEach((c) => {
        if (isFinite(probs[c])) {
          acc[m][c].sum += Number(probs[c]);
          acc[m][c].n += 1;
        }
      });
    });
  });

  const out = {};
  Object.entries(acc).forEach(([m, cls]) => {
    out[m] = {};
    ["negative", "neutral", "positive"].forEach((c) => {
      const { sum, n } = cls[c];
      out[m][c] = n ? sum / n : 0;
    });
  });

  return out;
}

function downloadJson(name, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/* best model per row */
function getBestModelForRow(r) {
  const per = r?.per_model || {};
  const hinted = r?.best_model_by_confidence;

  if (hinted && per[hinted]) {
    const v = per[hinted];
    const lbl = v?.label ?? "—";
    const conf = to01(v?.confidence ?? v?.probs?.[lbl] ?? 0);
    return { model: hinted, label: lbl, conf };
  }

  let best = { model: "—", label: "—", conf: 0 };
  for (const [m, v] of Object.entries(per)) {
    const lbl = v?.label ?? "—";
    const conf = to01(v?.confidence ?? v?.probs?.[lbl] ?? 0);
    if (conf > best.conf) best = { model: m, label: lbl, conf };
  }

  return best;
}

/* ========================================================================== */
/*                   UPDATED + CLEAN BATCH DEEP VIEW UI                       */
/* ========================================================================== */

export default function BatchDeepView({ data, onAnalyzeRow }) {
  if (!data) return null;

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const totalRows = rows.length;
  const consensus = Number(data?.summary?.consensus_rate ?? 0);
  const countsPerModel = data?.summary?.counts_per_model || {};

  const modelList = React.useMemo(() => {
    const s = new Set();
    rows.forEach((r) =>
      Object.keys(r?.per_model || {}).forEach((m) => s.add(m))
    );
    return Array.from(s).sort();
  }, [rows]);

  /* meta */
  const srcName =
    data?.meta?.source_name ||
    data?.meta?.file_name ||
    data?.file_name ||
    null;
  const processedAt = data?.meta?.processed_at || data?.processed_at || null;
  const langCounts = data?.meta?.lang_counts || null;

  /* stats */
  const { avgLen, emptyRows, avgMs } = React.useMemo(() => {
    let totalChars = 0,
      empties = 0,
      totalMs = 0,
      msCount = 0;
    rows.forEach((r) => {
      const t = r?.text ?? "";
      totalChars += t.length;
      if (!t.trim()) empties++;
      const ms = Number(r?.inference_ms);
      if (isFinite(ms)) {
        totalMs += ms;
        msCount++;
      }
    });
    return {
      avgLen: totalRows ? Math.round(totalChars / totalRows) : 0,
      emptyRows: empties,
      avgMs: msCount ? Math.round(totalMs / msCount) : null,
    };
  }, [rows, totalRows]);

  const classTotals = React.useMemo(() => {
    const tot = { negative: 0, neutral: 0, positive: 0 };
    rows.forEach((r) => {
      const best = getBestModelForRow(r);
      const n = normLabel(best.label);
      if (hasOwn(tot, n)) tot[n] += 1;
    });
    return tot;
  }, [rows]);

  const { models, pctMat } = React.useMemo(
    () => computeAgreementMatrix(rows),
    [rows]
  );

  const avgConf = React.useMemo(() => computeAvgConf(rows), [rows]);

  /* controls */
  const [q, setQ] = React.useState("");
  const [labelFilter, setLabelFilter] = React.useState("all");
  const [sortBy, setSortBy] = React.useState("none");
  const [sortDir, setSortDir] = React.useState("desc");

  const filteredRows = React.useMemo(() => {
    return rows.filter((r) => {
      const text = String(r?.text ?? "");
      const best = getBestModelForRow(r);
      const bestNorm = normLabel(best.label);
      const qOk = !q || text.toLowerCase().includes(q.toLowerCase());
      const lOk = labelFilter === "all" || bestNorm === labelFilter;
      return qOk && lOk;
    });
  }, [rows, q, labelFilter]);

  const sortedRows = React.useMemo(() => {
    if (sortBy === "none") return filteredRows;

    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const ta = String(a?.text ?? "");
      const tb = String(b?.text ?? "");
      const pa = a?.per_model || {};
      const pb = b?.per_model || {};
      const ma = Math.max(0, ...Object.values(pa).map((v) => Number(v?.confidence || 0)));
      const mb = Math.max(0, ...Object.values(pb).map((v) => Number(v?.confidence || 0)));
      const disa = new Set(Object.values(pa).map((v) => v?.label).filter(Boolean)).size;
      const disb = new Set(Object.values(pb).map((v) => v?.label).filter(Boolean)).size;
      const msa = Number(a?.inference_ms);
      const msb = Number(b?.inference_ms);

      let va = 0,
        vb = 0;
      if (sortBy === "maxconf") {
        va = ma;
        vb = mb;
      } else if (sortBy === "time") {
        va = isFinite(msa) ? msa : 0;
        vb = isFinite(msb) ? msb : 0;
      } else if (sortBy === "length") {
        va = ta.length;
        vb = tb.length;
      } else if (sortBy === "disagreement") {
        va = disa;
        vb = disb;
      }

      return sortDir === "asc" ? va - vb : vb - va;
    });

    return copy;
  }, [filteredRows, sortBy, sortDir]);

  /* ============================== RENDER ================================ */
  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="rounded-2xl border border-slate-600/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 grid place-items-center rounded-xl bg-emerald-500/15 border border-emerald-500/30">
              <BarChart2 className="h-5 w-5 text-emerald-300" />
            </div>

            <div>
              <div className="text-base font-semibold">Batch Deep Overview</div>

              <div className="text-xs opacity-70">
                {srcName ? (
                  <>
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" /> <b>{srcName}</b>
                    </span>
                    {processedAt && (
                      <>
                        <span className="mx-1">•</span>
                        <span className="inline-flex items-center gap-1">
                          <Timer className="h-3.5 w-3.5" /> {processedAt}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <span className="opacity-60">No metadata</span>
                )}
              </div>
            </div>
          </div>

          {/* right stats */}
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-slate-800/60 border border-slate-600/30">
              Rows: <b>{totalRows}</b>
            </span>
            <span className="px-2 py-1 rounded bg-slate-800/60 border border-slate-600/30">
              Models: <b>{modelList.length}</b>
            </span>
            {avgMs != null && (
              <span className="px-2 py-1 rounded bg-slate-800/60 border border-slate-600/30">
                Avg time: <b>{avgMs} ms</b>
              </span>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => downloadJson("batch_deep.json", data)}>
              <Download className="h-4 w-4" /> Export
            </button>
          </div>
        </div>

        {/* tiles */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <StatTile icon={TrendingUp} label="Consensus" value={pct(consensus)} />
          <StatTile icon={Layers} label="Disagreement" value={pct(1 - consensus)} />
          <StatTile icon={FileText} label="Avg. text length" value={`${avgLen} chars`} />
          <StatTile icon={Gauge} label="Empty rows" value={emptyRows} />
        </div>

        {/* class totals */}
        <div className="grid sm:grid-cols-3 gap-3 mt-4">
          {["negative", "neutral", "positive"].map((k) => (
            <div key={k} className="rounded-xl border border-slate-600/20 bg-slate-900/50 p-3">
              <div className="text-[11px] uppercase opacity-70">{k}</div>
              <div className="text-lg font-semibold">{classTotals[k]}</div>
              <div className="mt-2">
                <Bar
                  pct={(classTotals[k] / Math.max(1, totalRows)) * 100}
                  hue={k === "negative" ? "rose" : k === "neutral" ? "amber" : "emerald"}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* LANG BREAKDOWN */}
      {langCounts && (
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-4 w-4 opacity-80" />
            <div className="text-lg font-semibold">Language Breakdown</div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(langCounts).map(([lang, count]) => {
              const share = (Number(count || 0) / Math.max(1, totalRows)) * 100;
              return (
                <div key={lang} className="rounded-xl border border-slate-600/20 bg-slate-900/50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{lang}</span>
                    <span className="opacity-70">{count}</span>
                  </div>
                  <div className="mt-2">
                    <Bar pct={share} hue="emerald" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PER-MODEL OVERVIEW */}
      <div className="card">
        <div className="text-lg font-semibold mb-2">Per-Model Overview</div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(countsPerModel).map(([modelId, cls]) => (
            <div key={modelId} className="rounded-xl border border-slate-600/20 bg-slate-900/50 p-4">
              <div className="text-[11px] uppercase opacity-70 mb-1">
                Per-class — {modelId}
              </div>

              <div className="space-y-3">
                {["negative", "neutral", "positive"].map((k) => {
                  const count = Number(cls?.[k] ?? 0);
                  const share = (count / Math.max(1, totalRows)) * 100;
                  return (
                    <div key={k}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="uppercase opacity-70">{k}</div>
                        <div className="font-semibold">{count}</div>
                      </div>
                      <Bar
                        pct={share}
                        hue={k === "negative" ? "rose" : k === "neutral" ? "amber" : "emerald"}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AGREEMENT MATRIX */}
      {models.length > 1 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="h-4 w-4 opacity-80" />
            <div className="text-lg font-semibold">Agreement Matrix</div>
          </div>

          <div className="overflow-auto">
            <table className="tbl text-sm">
              <thead>
                <tr>
                  <th>Model</th>
                  {models.map((m) => (
                    <th key={m}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {models.map((mi, i) => (
                  <tr key={mi}>
                    <td className="font-medium">{mi}</td>
                    {models.map((mj, j) => {
                      const v = (pctMat?.[i]?.[j] ?? 0) * 100;
                      return (
                        <td key={`${mi}-${mj}`}>
                          <div className="min-w-[70px]">
                            <div className="text-[11px] opacity-70">{safeNum(v, 0)}%</div>
                            <Bar
                              pct={v}
                              hue={
                                i === j
                                  ? "emerald"
                                  : v >= 66
                                  ? "emerald"
                                  : v >= 40
                                  ? "amber"
                                  : "rose"
                              }
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DEEP TABLE */}
      <div className="card">
        <div className="text-lg font-semibold mb-2">Rows (Deep)</div>

        <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
          <input
            className="input input-sm"
            placeholder="Search text…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="select select-sm"
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
          >
            <option value="all">All labels</option>
            <option value="negative">negative</option>
            <option value="neutral">neutral</option>
            <option value="positive">positive</option>
          </select>
          <select
            className="select select-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="none">Sort: none</option>
            <option value="maxconf">Sort: max confidence</option>
            <option value="time">Sort: inference time</option>
            <option value="length">Sort: text length</option>
            <option value="disagreement">Sort: disagreement</option>
          </select>
          <select
            className="select select-sm"
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value)}
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>

        {/* TABLE */}
        {sortedRows.length > 0 && modelList.length > 0 && (
          <div className="overflow-auto rounded-xl border border-slate-700/40 bg-slate-900/50">
            <table className="tbl text-sm">
              <thead>
                <tr>
                  <th style={{ minWidth: 80 }}>Deep</th>
                  <th style={{ minWidth: 60 }}>#</th>
                  <th style={{ minWidth: 260 }}>Sentence</th>
                  <th style={{ minWidth: 180 }}>Best</th>

                  {modelList.map((m) => (
                    <th key={m} style={{ minWidth: 160 }}>
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {sortedRows.map((r, i) => {
                  const per = r?.per_model || {};
                  const text = r?.text ?? "";
                  const best = getBestModelForRow(r);

                  return (
                    <tr key={i}>
                      <td>
                        <button
                          type="button"
                          className="btn btn-primary btn-xs"
                          onClick={() => onAnalyzeRow?.(text)}
                          disabled={!text.trim()}
                        >
                          Deep
                        </button>
                      </td>

                      <td className="opacity-70">{i + 1}</td>
                      <td title={text}>{clamp(text, 140)}</td>

                      <td>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="px-1.5 py-0.5 rounded text-[11px] border bg-sky-500/10 border-sky-400/30 text-sky-200"
                          >
                            {best.model}
                          </span>
                          <span className="text-xs font-semibold">{toPct(best.conf)}</span>
                        </div>
                      </td>

                      {modelList.map((m) => {
                        const v = per[m] || {};
                        const lbl = v?.label ?? "—";
                        const conf = to01(v?.confidence ?? v?.probs?.[lbl] ?? 0);

                        return (
                          <td key={`${i}-${m}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[11px] border ${
                                  normLabel(lbl) === "positive"
                                    ? "bg-emerald-500/10 border-emerald-400/30 text-emerald-200"
                                    : normLabel(lbl) === "negative"
                                    ? "bg-rose-500/10 border-rose-400/30 text-rose-200"
                                    : normLabel(lbl) === "neutral"
                                    ? "bg-amber-500/10 border-amber-400/30 text-amber-200"
                                    : "bg-slate-500/10 border-slate-400/30 text-slate-200"
                                }`}
                              >
                                {lbl}
                              </span>

                              <span className="text-xs font-semibold">
                                {toPct(conf)}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
