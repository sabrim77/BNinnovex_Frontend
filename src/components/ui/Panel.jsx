// path: src/components/ui/Panel.jsx
import React, { useState, forwardRef, useId } from "react";
import PropTypes from "prop-types";

/* tiny classnames helper */
function cx(...xs) { return xs.filter(Boolean).join(" "); }

/**
 * Panel — glassy card wrapper (accessible + extensible)
 *
 * Props:
 *  - as: element/tag (default "section")
 *  - id: stable id to derive aria ids
 *  - title, subtitle, right, actions, footer, children
 *  - variant: "default" | "ghost" | "outline"
 *  - density: "normal" | "cozy" | "compact"
 *  - collapsible, defaultOpen, loading
 *  - className/headerClassName/bodyClassName/footerClassName
 *  - ariaLabel (if custom title node)
 *  - onToggle(open)
 */
const Panel = forwardRef(function Panel(
  {
    as: Tag = "section",
    id,
    title,
    subtitle,
    right = null,
    actions = null,
    footer = null,
    children,
    variant = "default",
    density = "normal",
    collapsible = false,
    defaultOpen = true,
    loading = false,
    className = "",
    headerClassName = "",
    bodyClassName = "",
    footerClassName = "",
    ariaLabel,
    onToggle,
  },
  ref
) {
  const [open, setOpen] = useState(defaultOpen);
  const uid = useId();
  const headingId = id ? `${id}-heading` : `panel-${uid}-heading`;
  const bodyId = id ? `${id}-body` : `panel-${uid}-body`;

  const densityPad = { normal: "p-6", cozy: "p-5", compact: "p-4" }[density] || "p-6";

  const baseCard = "rounded-2xl border backdrop-blur shadow-md shadow-slate-900/30 transition-colors";
  const variants = {
    default: "border-slate-800/70 bg-slate-900/60 hover:border-slate-700/70",
    ghost:   "border-transparent bg-slate-900/30 hover:bg-slate-900/40 hover:border-slate-800/40",
    outline: "border-slate-700/70 bg-transparent hover:border-slate-600/70",
  };

  const headerPadding = density === "compact" ? "px-4 py-3" : density === "cozy" ? "px-5 py-3.5" : "px-6 py-4";
  const bodyPadding = densityPad;
  const footerPadding = density === "compact" ? "px-4 py-3" : density === "cozy" ? "px-5 py-3.5" : "px-6 py-4";

  const showHeader = title || subtitle || right || actions || collapsible;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    onToggle?.(next);
  };

  return (
    <Tag
      ref={ref}
      id={id}
      aria-labelledby={!ariaLabel && showHeader && typeof title === "string" ? headingId : undefined}
      aria-label={ariaLabel || (typeof title === "string" ? undefined : "Panel")}
      className={cx(baseCard, variants[variant] || variants.default, className)}
    >
      {loading && (
        <div className="pointer-events-none relative" role="progressbar" aria-label="Loading">
          <div className="absolute left-0 top-0 h-[2px] w-full overflow-hidden rounded-t-2xl">
            <div className="h-full w-1/3 animate-[panelload_1.2s_ease-in-out_infinite] bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-cyan-400/90" />
          </div>
        </div>
      )}

      {showHeader && (
        <div className={cx("border-b border-slate-800/60", headerPadding, headerClassName)}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title && (
                <div id={headingId} className="font-semibold text-slate-100 text-[15px] leading-6 truncate">
                  {title}
                </div>
              )}
              {subtitle && <div className="mt-0.5 text-xs text-slate-400 leading-5 truncate">{subtitle}</div>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {right}
              {actions}
              {collapsible && (
                <button
                  type="button"
                  onClick={toggle}
                  aria-controls={bodyId}
                  aria-expanded={open}
                  aria-label={open ? "Collapse panel" : "Expand panel"}
                  className="rounded-md p-1.5 text-slate-300 hover:text-slate-100 hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                >
                  <svg
                    className={cx("h-4 w-4 transform transition-transform motion-reduce:transition-none", open ? "rotate-0" : "-rotate-90")}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div id={bodyId} className={cx(bodyPadding, bodyClassName, collapsible ? (open ? "block" : "hidden") : "")}>
        {children}
      </div>

      {footer && <div className={cx("border-t border-slate-800/60", footerPadding, footerClassName)}>{footer}</div>}
    </Tag>
  );
});

Panel.displayName = "Panel";

Panel.propTypes = {
  as: PropTypes.elementType,
  id: PropTypes.string,
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  subtitle: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  right: PropTypes.node,
  actions: PropTypes.node,
  footer: PropTypes.node,
  children: PropTypes.node,
  variant: PropTypes.oneOf(["default", "ghost", "outline"]),
  density: PropTypes.oneOf(["normal", "cozy", "compact"]),
  collapsible: PropTypes.bool,
  defaultOpen: PropTypes.bool,
  loading: PropTypes.bool,
  className: PropTypes.string,
  headerClassName: PropTypes.string,
  bodyClassName: PropTypes.string,
  footerClassName: PropTypes.string,
  ariaLabel: PropTypes.string,
  onToggle: PropTypes.func,
};

export default Panel;

/* Optional global keyframes (or keep Tailwind arbitrary):
@keyframes panelload {
  0%   { transform: translateX(-100%); }
  50%  { transform: translateX(30%); }
  100% { transform: translateX(120%); }
}
*/
