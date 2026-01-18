import React from 'react';
import { AlertTriangle as BiError } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen bg-[var(--color-background)] flex flex-col items-center justify-center p-4">
          <div className="bg-[var(--color-surface)] rounded-xl shadow-lg p-8 max-w-md w-full text-center border border-[var(--color-border)]">
            <div className="bg-danger/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <BiError className="text-danger text-3xl" />
            </div>
            <h1 className="text-xl font-bold text-[var(--color-text-heading)] mb-2">Something went wrong</h1>
            <p className="text-[var(--color-text-muted)] mb-6">
              The application encountered an unexpected error. We apologize for the inconvenience.
            </p>
            
            <div className="bg-[var(--color-background)] rounded-lg p-3 mb-6 text-left overflow-auto max-h-32 border border-[var(--color-border)]">
              <code className="text-xs text-danger font-mono break-all">
                {this.state.error && this.state.error.toString()}
              </code>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReload}
                className="w-full bg-primary text-white py-2 px-4 rounded-lg hover:bg-primary-dark transition-colors font-medium shadow-sm"
              >
                Reload Page
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-[var(--color-surface-hover)] text-[var(--color-text)] border border-[var(--color-border)] py-2 px-4 rounded-lg hover:bg-[var(--color-surface)] transition-colors font-medium"
              >
                Go to Dashboard
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
