import React from 'react';
import { FiAlertTriangle, FiRefreshCw, FiHome } from 'react-icons/fi';

class EnhancedErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0
    };
  }

  // error argument intentionally unused; just update state
  static getDerivedStateFromError(_error) {
    return { hasError: true };
  }

  componentDidCatch(_error, errorInfo) {
    this.setState({
      error: _error,
      errorInfo,
      retryCount: this.state.retryCount + 1
    });

    // Log error to service (optional)
    this.logError(_error, errorInfo);
  }

  logError = (error, errorInfo) => {
    const errorData = {
      error: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    console.error('Error Boundary Caught:', errorData);

    // Errors thrown during render never reach any axios/API-client instance
    // (those live inside the component tree that just crashed), so this is
    // the only way a render crash gets recorded anywhere — previously it
    // only went to the browser console, which nobody sees for reports like
    // "queue dashboard sometimes goes blank" that happen on a clinic PC.
    // keepalive lets the request survive if a reload/navigation follows.
    try {
      const apiBase = (import.meta.env && import.meta.env.VITE_API_URL) || '';
      fetch(`${apiBase}/api/logs/error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          message: error.toString().slice(0, 1000),
          stack: (error.stack || '').slice(0, 5000),
          url: window.location.href,
          userAgent: navigator.userAgent,
          context: { componentStack: (errorInfo.componentStack || '').slice(0, 2000) },
          severity: 'error'
        })
      }).catch(() => {});
    } catch { /* best-effort only */ }
  };

  handleRetry = () => {
    if (this.state.retryCount < 3) {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                <FiAlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Oops! Something went wrong
              </h1>
              
              <p className="text-gray-600 mb-6">
                We're sorry for the inconvenience. The application encountered an unexpected error.
              </p>

              {this.state.retryCount < 3 && (
                <div className="mb-4">
                  <button
                    onClick={this.handleRetry}
                    className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mb-3"
                  >
                    <FiRefreshCw className="mr-2" />
                    Try Again ({3 - this.state.retryCount} attempts left)
                  </button>
                </div>
              )}

              <button
                onClick={this.handleGoHome}
                className="w-full flex items-center justify-center px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <FiHome className="mr-2" />
                Go to Homepage
              </button>

              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Error Details (for developers)
                </summary>
                <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-32">
                  {this.state.error && this.state.error.toString()}
                </pre>
              </details>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default EnhancedErrorBoundary;
