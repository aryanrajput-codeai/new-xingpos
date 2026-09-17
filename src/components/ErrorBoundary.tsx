import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends (React.Component as any) {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("[React ErrorBoundary] Uncaught rendering exception:", error, errorInfo);
  }

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.hash = "#/";
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-900 text-white flex items-center justify-center p-6 font-sans select-none">
          <div className="max-w-lg w-full bg-stone-800 border border-stone-700 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold font-serif uppercase tracking-wider text-stone-100">
                Application Display Error
              </h2>
              <p className="text-xs text-stone-400 leading-relaxed font-sans">
                An unexpected component rendering issue occurred. Your POS database, billing state, and active orders remain completely safe.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-stone-950/80 border border-stone-800 rounded-xl p-4 text-left font-mono text-[11px] text-red-400 overflow-x-auto max-h-32">
                <div className="font-bold text-stone-300 mb-1">Error Message:</div>
                <div>{String(this.state.error)}</div>
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={this.handleReload}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
