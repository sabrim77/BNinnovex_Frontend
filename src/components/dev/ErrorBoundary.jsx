// path: src/components/dev/ErrorBoundary.jsx
import React from "react";

export default class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("[Sidebar Error]", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 text-sm text-red-200 bg-red-900/30 border border-red-700/50 rounded-xl m-3">
          <div className="font-semibold">Sidebar crashed</div>
          <pre className="mt-2 whitespace-pre-wrap">{String(this.state.error?.message || this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
