import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[CubOS] Render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-4 max-w-md text-center">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
              <span className="text-xl font-bold text-destructive">!</span>
            </div>
            <h1 className="text-base font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground font-mono break-all">{this.state.error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
