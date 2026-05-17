import { Component, type ReactNode } from "react";
import { YutoLogo } from "./YutoLogo";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-white dark:bg-black text-center">
          <YutoLogo className="w-12 h-12 mb-6" />
          <h1 className="text-xl font-bold text-black dark:text-white mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
            We hit an unexpected error. Try refreshing or heading back home.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-3 bg-gray-100 dark:bg-zinc-800 text-black dark:text-white rounded-xl font-bold text-sm border-none"
            >
              Refresh
            </button>
            <button
              onClick={() => { window.location.href = "/home"; }}
              className="px-5 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm border-none"
            >
              Go Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
