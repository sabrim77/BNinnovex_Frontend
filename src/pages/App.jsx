// path: src/pages/App.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import Navbar from "../components/layout/Navbar.jsx";
import Sidebar from "../components/layout/Sidebar.jsx";
import ErrorBoundary from "../components/dev/ErrorBoundary.jsx";
import { PlaySquare, Newspaper, Type, ArrowRight } from "lucide-react";

/* utils */
const cx = (...parts) => parts.filter(Boolean).join(" ");

const ROUTES = Object.freeze({
  youtube: "/youtube?tab=single",
  news: "/news?tab=ingest",
  normal: "/normal?tab=single",
  live: "/live",
});

const KEYBINDS = Object.freeze({ y: ROUTES.youtube, n: ROUTES.news, t: ROUTES.normal });
const STORAGE_KEY = "railCollapsed";

/* focus ring */
const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50";

/* --------------------- Accent presets (blue + indigo family) --------------------- */
const ACCENTS = {
  sky: {
    frame:
      "bg-[linear-gradient(135deg,theme(colors.indigo.600),theme(colors.blue.600),theme(colors.sky.500))]",
    puck:
      "bg-[radial-gradient(120%_120%_at_30%_20%,theme(colors.sky.400/.45),theme(colors.blue.600/.35)_35%,transparent_60%)]",
    chip: "bg-sky-500/12 text-sky-200 ring-1 ring-sky-300/35",
  },
  indigo: {
    frame:
      "bg-[linear-gradient(135deg,theme(colors.indigo.700),theme(colors.indigo.600),theme(colors.blue.500))]",
    puck:
      "bg-[radial-gradient(120%_120%_at_30%_20%,theme(colors.indigo.400/.50),theme(colors.indigo.700/.34)_35%,transparent_60%)]",
    chip: "bg-indigo-500/12 text-indigo-200 ring-1 ring-indigo-300/35",
  },
  blue: {
    frame:
      "bg-[linear-gradient(135deg,theme(colors.blue.700),theme(colors.blue.600),theme(colors.indigo.500))]",
    puck:
      "bg-[radial-gradient(120%_120%_at_30%_20%,theme(colors.blue.400/.45),theme(colors.indigo.600/.32)_35%,transparent_60%)]",
    chip: "bg-blue-500/12 text-blue-200 ring-1 ring-blue-300/35",
  },
};

/* ================= Long Card (icon centered at top, vertical stack) ================= */
const Card = React.memo(function Card({
  Icon,
  title,
  blurb,
  onPrimary,
  primaryLabel,
  chips = [],
  accent = "blue",
}) {
  const A = ACCENTS[accent] || ACCENTS.blue;

  return (
    <div
      className={cx(
        "group relative rounded-3xl p-[2px]",
        A.frame,
        "bg-[length:200%_200%] motion-safe:animate-[cardglow_6s_ease_infinite]",
        "shadow-[0_18px_52px_-18px_rgba(37,99,235,0.55)]"
      )}
    >
      <section
        className={cx(
          "rounded-3xl bg-slate-950/90 backdrop-blur-xl ring-1 ring-white/8",
          "min-h-[360px] p-7 flex flex-col"
        )}
        aria-label={title}
      >
        {/* centered icon */}
        <div
          className={cx(
            "mx-auto h-16 w-16 rounded-2xl grid place-items-center",
            "text-slate-100",
            A.puck,
            "ring-1 ring-white/10",
            "shadow-[0_14px_40px_-16px_rgba(37,99,235,0.6)]"
          )}
          aria-hidden="true"
        >
          <Icon className="h-7 w-7" />
        </div>

        {/* centered title + blurb */}
        <h3 className="mt-4 text-center text-[18px] font-semibold tracking-tight text-slate-50">
          {title}
        </h3>
        <p className="mt-2 text-center text-[13px] leading-6 text-slate-300/95">{blurb}</p>

        {/* chips (centered) */}
        {chips?.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {chips.map((c, i) => (
              <span
                key={i}
                className={cx(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]",
                  "shadow-[0_10px_32px_-18px_rgba(15,23,42,0.8)]",
                  A.chip
                )}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-current/70" />
                {c}
              </span>
            ))}
          </div>
        )}

        {/* button pinned to bottom */}
        <div className="mt-auto pt-5">
          <button
            type="button"
            onClick={onPrimary}
            className={cx(
              "w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-medium",
              "bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-500 hover:from-indigo-500 hover:via-blue-500 hover:to-sky-400 text-white",
              "shadow-[0_12px_40px_-18px_rgba(37,99,235,0.8)] active:scale-[.98] transition-transform transition-colors",
              focusRing
            )}
            aria-label={`${title}: ${primaryLabel}`}
          >
            {primaryLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
});
Card.displayName = "Card";
Card.propTypes = {
  Icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  blurb: PropTypes.string.isRequired,
  onPrimary: PropTypes.func.isRequired,
  primaryLabel: PropTypes.string.isRequired,
  chips: PropTypes.arrayOf(PropTypes.string),
  accent: PropTypes.oneOf(["sky", "indigo", "blue"]),
};

/* ================================ Pills (black + blue glow) ================================ */
const PILL_SIZES = {
  lg: {
    wrap: "w-[360px] px-6 py-5",
    iconBox: "h-12 w-12",
    icon: 22,
    title: "text-[15px]",
    sub: "text-[12px]",
  },
  md: {
    wrap: "w-[300px] px-5 py-4",
    iconBox: "h-10 w-10",
    icon: 20,
    title: "text-[14px]",
    sub: "text-[12px]",
  },
  sm: {
    wrap: "w-[240px] px-4 py-3",
    iconBox: "h-9 w-9",
    icon: 18,
    title: "text-[13px]",
    sub: "text-[11px]",
  },
};

const Pill = React.memo(function Pill({ onClick, Icon, title, subtitle, size = "md", mirror = false }) {
  const S = PILL_SIZES[size] ?? PILL_SIZES.md;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${title}${subtitle ? `: ${subtitle}` : ""}`}
      className={[
        "rounded-full bg-slate-950/80 text-slate-100",
        "border border-slate-800/80 ring-1 ring-sky-500/35",
        "hover:bg-slate-950/90",
        "shadow-[0_10px_30px_-14px_rgba(37,99,235,0.6)] hover:shadow-[0_18px_44px_-18px_rgba(37,99,235,0.7)]",
        "backdrop-blur-lg transition-all active:scale-[.98]",
        "flex items-center gap-3",
        "motion-safe:hover:-translate-y-[2px]",
        focusRing,
        S.wrap,
      ].join(" ")}
    >
      <span
        className={[
          "inline-grid place-items-center shrink-0 rounded-full",
          "bg-slate-900 text-slate-100 ring-1 ring-slate-700/80",
          "shadow-[0_8px_26px_-14px_rgba(37,99,235,0.7)]",
          S.iconBox,
        ].join(" ")}
        aria-hidden="true"
      >
        <Icon size={S.icon} />
      </span>
      <span className={cx("min-w-0", mirror && "text-right")}>
        <span className={cx("block font-semibold", S.title)}>{title}</span>
        {subtitle && (
          <span className={cx("block text-slate-300/95 truncate", S.sub)}>{subtitle}</span>
        )}
      </span>
    </button>
  );
});
Pill.displayName = "Pill";
Pill.propTypes = {
  onClick: PropTypes.func.isRequired,
  Icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  size: PropTypes.oneOf(["lg", "md", "sm"]),
  mirror: PropTypes.bool,
};

/* ------------------------------- App (Dashboard) ------------------------------ */
export default function App() {
  const nav = useNavigate();
  const mainRef = useRef(null);

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

  const onKey = useCallback(
    (e) => {
      const el = document.activeElement;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed((v) => !v);
        return;
      }
      if (typing || e.altKey || e.ctrlKey || e.metaKey) return;

      const k = e.key.toLowerCase();
      const route = KEYBINDS[k];
      if (route) {
        nav(route);
        requestAnimationFrame(() => mainRef.current?.focus());
      }
    },
    [nav]
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const actions = useMemo(
    () => ({
      openYouTube: () => nav(ROUTES.youtube),
      openNews: () => nav(ROUTES.news),
      openNormal: () => nav(ROUTES.normal),
    }),
    [nav]
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#020617] text-slate-100 isolate">
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-blue-600 focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>

      <Navbar collapsed={collapsed} setCollapsed={setCollapsed} />

      <div
        className={cx(
          "grid h-[calc(100vh-56px)] transition-[grid-template-columns] duration-200",
          collapsed ? "grid-cols-[80px_1fr]" : "grid-cols-[280px_1fr]"
        )}
      >
        {/* Sidebar */}
        <aside
          className="h-full min-w-0 border-r border-slate-800/60 bg-slate-950/40 backdrop-blur will-change-transform"
          aria-label="Primary navigation"
          role="region"
        >
          <ErrorBoundary>
            <Sidebar collapsed={collapsed} />
          </ErrorBoundary>
        </aside>

        {/* Main */}
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          role="main"
          className="relative h-full min-h-0 overflow-y-auto px-4 md:px-8 py-8"
          aria-label="Dashboard"
        >
          {/* blue-only background blobs */}
          <div
            className="pointer-events-none absolute inset-0 -z-10 motion-safe:block motion-reduce:hidden"
            aria-hidden="true"
          >
            <div className="absolute -top-40 -left-40 h-[420px] w-[420px] rounded-full blur-3xl opacity-[0.14] bg-gradient-to-br from-indigo-600/26 via-blue-600/22 to-sky-500/20" />
            <div className="absolute -bottom-48 -right-48 h-[520px] w-[520px] rounded-full blur-3xl opacity-[0.14] bg-gradient-to-tr from-blue-600/22 via-sky-500/20 to-indigo-600/22" />
          </div>

          {/* Header (centered) */}
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-[28px] md:text-[34px] font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-indigo-300 via-blue-300 to-sky-300 bg-clip-text text-transparent">
                UniSentiX
                </span>
                </h1>
                <p className="mt-1 text-slate-300 text-sm md:text-base">
                  Unified Sentiment Intelligence System
                  </p>

            <p className="mt-1.5 text-slate-300 text-sm">
                A unified sentiment intelligence platform for YouTube, news, and text — delivering fast, multilingual insights in Bangla, English, and Banglish. Shortcuts: <b>Y</b>/<b>N</b>/<b>T</b>.
            </p>
            <div className="mt-3 flex flex-wrap justify-center items-center gap-2">
              <span className="rounded-md border border-slate-800/70 bg-slate-900/70 px-2.5 py-1 text-[11px] text-slate-300">
                Bangla • English • Banglish
              </span>
            </div>
          </div>

          {/* Cards (three, centered) */}
          <div className="mt-10 md:mt-12 max-w-6xl mx-auto grid gap-x-8 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
            <Card
              Icon={PlaySquare}
              title="YouTube Sentiment Analysis"
              blurb="Process video captions, apply intelligent segmentation, and compute sentiment with CC-first accuracy."
              onPrimary={actions.openYouTube}
              primaryLabel="Open & Extract Youtube  "
              chips={["Subtitles", "AI Summary"]}
              accent="sky"
            />
            <Card
              Icon={Newspaper}
              title="News Sentiment Analysis"
              blurb="Aggregate, filter, and analyze news articles at scale to reveal sentiment and narrative shifts."
              onPrimary={actions.openNews}
              primaryLabel="Open News Analysis"
              chips={["RSS", "Keyword", "Parser"]}
              accent="indigo"
            />
            <Card
              Icon={Type}
              title="Text Sentiment Analysis"
              blurb="Unlock expressive sentiment analysis — from quick text checks to advanced batch processing — all in one place."
              onPrimary={actions.openNormal}
              primaryLabel="Open Text Analysis"
              chips={["Single Text", "CSV/XLSX"]}
              accent="blue"
            />
          </div>

          {/* Floating oval shortcuts */}
          
        </main>
      </div>
    </div>
  );
}

/* keyframes note:
@keyframes cardglow { 0% { background-position:0% 50% } 50% { background-position:100% 50% } 100% { background-position:0% 50% } }
If purging, safelist 'cardglow' in your Tailwind config.
*/
