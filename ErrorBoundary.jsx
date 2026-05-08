import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null, errorInfo: null }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { this.setState({ error, errorInfo }); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 text-red-800 h-screen w-full flex flex-col items-center justify-center overflow-auto z-50 absolute inset-0">
          <h1 className="text-2xl font-bold mb-4">React Compilation Error Detected</h1>
          <pre className="text-sm bg-white p-4 rounded-xl border border-red-200 shadow-sm max-w-2xl w-full">{this.state.error && this.state.error.toString()}</pre>
          <button className="mt-6 bg-red-600 text-white px-8 py-3 rounded-xl font-bold shadow-[0_4px_15px_rgba(220,38,38,0.3)] hover:scale-105 transition-transform" onClick={() => window.location.reload()}>Reload Application</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
