import { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Home } from 'lucide-react';
import { AppleButton } from './AppleButton';
import { BrandLogo } from './BrandLogo';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught MediArca runtime error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '#/';
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f5f5f7] flex flex-col justify-center items-center px-4 sm:px-6 text-center select-none">
          <div className="w-16 h-16 rounded-3xl bg-white border border-[#e0e0e0] flex items-center justify-center text-[#0088e8] shadow-sm mb-6 p-2">
            <BrandLogo variant="icon" size="lg" />
          </div>

          <span className="text-xs font-semibold text-[#0088e8] uppercase tracking-wider mb-2">
            MediArca Clinical System
          </span>

          <h1 className="text-2xl sm:text-3xl font-semibold text-[#1d1d1f] tracking-tight mb-3">
            Something unexpected occurred
          </h1>

          <p className="text-sm text-[#7a7a7a] max-w-md mx-auto leading-relaxed mb-8">
            An unexpected application state occurred. Your session data is intact. You can reload this view or return to the main dashboard.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <AppleButton
              variant="primary"
              size="md"
              onClick={this.handleReload}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Application
            </AppleButton>
            <AppleButton
              variant="ghost"
              size="md"
              onClick={this.handleReset}
              className="flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              Return Home
            </AppleButton>
          </div>

          {this.state.error && (
            <div className="mt-8 max-w-xl text-left p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono overflow-auto max-h-40">
              {this.state.error.toString()}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
