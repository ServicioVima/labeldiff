import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

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
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl border border-zinc-200 p-10 text-center space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-red-50 flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-zinc-900">Algo salió mal</h2>
              <p className="text-zinc-500 text-sm leading-relaxed">
                La aplicación ha encontrado un error inesperado al procesar los archivos.
              </p>
            </div>
            {this.state.error && (
              <div className="p-4 bg-zinc-50 rounded-2xl text-left overflow-auto max-h-40">
                <code className="text-[10px] text-red-600 font-mono">{this.state.error.toString()}</code>
              </div>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              Reiniciar aplicación
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
