import { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, Home, AlertTriangle } from 'lucide-react';
import { AppleButton } from './AppleButton';

interface Props {
  children: ReactNode;
  isInline?: boolean;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const isChunkLoadError = (err: Error | null): boolean => {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  return (
    msg.includes('dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('failed to fetch dynamically imported') ||
    msg.includes('failed to load module script') ||
    msg.includes('importing a module script failed') ||
    err.name === 'ChunkLoadError'
  );
};

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
    if (isChunkLoadError(error)) {
      const lastReload = window.sessionStorage.getItem('mediarca_boundary_chunk_reload');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
        window.sessionStorage.setItem('mediarca_boundary_chunk_reload', String(now));
        this.handleReload();
      }
    }
  }

  private handleReset = () => {
    if (isChunkLoadError(this.state.error)) {
      this.handleReload();
      return;
    }
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null });
    if (!this.props.isInline) {
      window.location.href = '#/';
    }
  };

  private handleReload = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('_v', Date.now().toString());
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      const isChunk = isChunkLoadError(this.state.error);

      // Localized route/section error: maintains surrounding navigation & header
      if (this.props.isInline) {
        return (
          <div className="w-full py-12 px-4 flex items-center justify-center select-none animate-fadeIn">
            <div className="max-w-[480px] w-full bg-white rounded-[24px] border border-[#e5e5ea] shadow-[0_20px_50px_rgba(0,0,0,0.06),0_2px_10px_rgba(0,0,0,0.02)] p-6 sm:p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-[20px] font-semibold text-[#1d1d1f] tracking-tight leading-snug">
                  {isChunk
                    ? 'New Version Available'
                    : this.props.fallbackTitle || 'Section Temporarily Unavailable'}
                </h2>
                <p className="text-[13px] text-[#86868b] mt-1.5 leading-relaxed">
                  {isChunk
                    ? 'A new version of MediArca is live. Please reload to load the latest features.'
                    : this.props.fallbackDescription ||
                      'An unexpected issue occurred while rendering this view. You can retry loading this section or navigate to another view.'}
                </p>
              </div>

              {this.state.error && !isChunk && (
                <div className="text-left p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] text-[#6e6e73] text-xs leading-relaxed overflow-auto max-h-24">
                  {this.state.error.message || this.state.error.toString()}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <AppleButton
                  variant="primary"
                  size="md"
                  onClick={isChunk ? this.handleReload : this.handleReset}
                  className="flex items-center gap-2 text-xs h-9 px-4 font-medium"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {isChunk ? 'Update & Reload' : 'Try Again'}
                </AppleButton>
                <AppleButton
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    this.setState({ hasError: false, error: null });
                    window.location.href = '#/';
                  }}
                  className="flex items-center gap-2 text-xs h-9 px-4 font-medium"
                >
                  <Home className="w-3.5 h-3.5" />
                  Return Home
                </AppleButton>
              </div>
            </div>
          </div>
        );
      }

      // Root-level full viewport error fallback
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
