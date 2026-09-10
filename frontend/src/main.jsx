import { StrictMode, Component } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { LanguageProvider } from './context/LanguageContext';

// One-time localStorage clear for v2 deploy (removes stale auth state)
const CACHE_VERSION = 'v2';
if (localStorage.getItem('_cache_version') !== CACHE_VERSION) {
  localStorage.clear();
  localStorage.setItem('_cache_version', CACHE_VERSION);
}

// Best-effort crash reporter. React error boundaries only catch render-phase
// errors — a throw inside an event handler, a useEffect's async callback, or
// an unhandled promise rejection (all common in this app's data-fetching
// code) skips every boundary silently: the console gets a red line nobody
// on a clinic PC ever sees, and the page is left wherever it was, which for
// a component whose first fetch never finished looks like a blank screen.
// keepalive lets the request survive a reload/navigation that follows.
function reportCrash(message, stack, extra) {
  try {
    const apiBase = (import.meta.env && import.meta.env.VITE_API_URL) || '';
    fetch(`${apiBase}/api/logs/error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        message: String(message || 'Unknown error').slice(0, 1000),
        stack: String(stack || '').slice(0, 5000),
        url: window.location.href,
        userAgent: navigator.userAgent,
        context: extra || {},
        severity: 'error'
      })
    }).catch(() => {});
  } catch { /* best-effort only */ }
}
window.addEventListener('error', (event) => {
  reportCrash(event.message, event.error?.stack, { source: 'window.onerror', filename: event.filename, lineno: event.lineno });
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  reportCrash(reason?.message || String(reason), reason?.stack, { source: 'unhandledrejection' });
});

// Initialize Sentry lazily - don't block initial render
if (import.meta.env.VITE_SENTRY_DSN) {
  import('./utils/sentry').catch(() => {});
}

class RootErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Root error boundary caught:', error);
    // This boundary catching anything means it escaped every page-level
    // EnhancedErrorBoundary too — the most severe crash tier. It's also
    // followed by an auto-reload below, which would otherwise erase any
    // trace of what happened.
    reportCrash(error?.toString(), error?.stack, {
      source: 'root-error-boundary',
      componentStack: (errorInfo?.componentStack || '').slice(0, 2000)
    });
    // Clear potentially corrupted storage and reload once
    try {
      const reloaded = sessionStorage.getItem('_eb_reloaded');
      if (!reloaded) {
        sessionStorage.setItem('_eb_reloaded', '1');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.reload();
      }
    } catch { /* empty — reload already attempted */ }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'sans-serif', flexDirection:'column', gap:'12px' }}>
          <h2 style={{ color:'#dc2626' }}>Something went wrong</h2>
          <button onClick={() => { sessionStorage.removeItem('_eb_reloaded'); window.location.href = '/'; }} style={{ padding:'8px 20px', background:'#2563eb', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer' }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <StrictMode>
      <RootErrorBoundary>
        <AuthProvider>
          <ToastProvider>
            <LanguageProvider>
              <App />
            </LanguageProvider>
          </ToastProvider>
        </AuthProvider>
      </RootErrorBoundary>
    </StrictMode>
  </BrowserRouter>
);
