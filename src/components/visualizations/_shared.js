// Small helpers used across visualizations (JS-safe, no JSX)

/** clamp long text safely */
export const clamp = (s, n = 140) =>
  typeof s === "string" ? (s.length > n ? s.slice(0, n) + "…" : s) : "";

/** Map label -> tone class suffix */
export const tone = (label) =>
  label === "positive" ? "pos" : label === "negative" ? "neg" : "neu";

/** Convert {negative, neutral, positive} possibly missing → sane object */
export const normDist = (d) => ({
  negative: Number(d?.negative ?? 0),
  neutral:  Number(d?.neutral  ?? 0),
  positive: Number(d?.positive ?? 0),
});

/** Safe array — always returns an array, never undefined */
export const arr = (v) => (Array.isArray(v) ? v : []);

/**
 * SafeList: JSX-free guard so components don’t crash when data is missing.
 * Returns an array of rendered nodes, or a <div> created via React.createElement when empty.
 * Keep this file as .js — no JSX here.
 */
import React from "react"; // required for createElement
export const SafeList = ({ items, render, empty = "—" }) => {
  const list = arr(items);
  if (!list.length) {
    return React.createElement("div", { className: "text-sm opacity-60" }, empty);
  }
  // preserve the original render signature (item, index)
  return list.map((item, i) => render(item, i));
};
