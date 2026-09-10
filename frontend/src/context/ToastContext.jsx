/* eslint-disable react-refresh/only-export-components */
import { createContext, useMemo, useState, useCallback, useRef, useContext } from 'react';

const ToastContext = createContext();

export { ToastContext };

// Convenience hook to consume the toast context
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0); // unique incremental id

  const addToast = useCallback((message, type = 'info') => {
    const id = idRef.current++; // hamesha unique id

    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const value = useMemo(() => ({ addToast }), [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 space-y-2 z-50">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-2.5 rounded-lg shadow-lg text-white font-medium transition-all ${
              toast.type === 'error'
                ? 'bg-red-600 border-2 border-red-700'
                : toast.type === 'success'
                ? 'bg-green-600'
                : 'bg-slate-800'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}