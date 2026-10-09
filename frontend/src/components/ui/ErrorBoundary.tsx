import { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Home } from 'lucide-react';
import { AppleButton } from './AppleButton';

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
        <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-4 sm:p-6 select-none">
          <div className="max-w-[450px] w-full bg-white rounded-[28px] border border-[#e5e5ea] shadow-[0_24px_60px_rgba(0,0,0,0.08),0_2px_10px_rgba(0,0,0,0.03)] p-6 sm:p-7 text-center space-y-5">
            <div>
              <h1 className="text-[22px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                Something unexpected occurred
              </h1>
              <p className="text-[13px] text-[#86868b] mt-1.5 leading-relaxed">
                An unexpected application state occurred. Your session data is intact. You can reload this view or return to the main dashboard.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left p-3.5 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#48484a] text-xs overflow-auto max-h-36 leading-relaxed">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
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
                variant="secondary"
                size="md"
                onClick={this.handleReset}
                className="flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Return Home
              </AppleButton>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
