import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(_error, _info) {
    // You can log the error to an external service here
    // console.error('ErrorBoundary caught:', _error, _info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 text-red-700 rounded">
          <h2 className="text-lg font-semibold">Something went wrong.</h2>
          <p className="mt-2">An unexpected error occurred in this section. Please reload the page.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
