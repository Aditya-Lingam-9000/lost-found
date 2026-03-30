import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const PopupContext = createContext(null);

function toneSymbol(tone) {
  if (tone === "success") return "✓";
  if (tone === "error") return "!";
  if (tone === "warning") return "!";
  return "i";
}

export function PopupProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const resolverRef = useRef(null);

  const notify = useCallback((message, tone = "info", duration = 3200) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const confirm = useCallback((config) => {
    const safeConfig = {
      title: config?.title || "Please Confirm",
      message: config?.message || "Are you sure you want to continue?",
      confirmText: config?.confirmText || "Yes",
      cancelText: config?.cancelText || "No",
      tone: config?.tone || "warning",
    };

    setConfirmState(safeConfig);
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const resolveConfirm = useCallback((value) => {
    if (resolverRef.current) {
      resolverRef.current(value);
      resolverRef.current = null;
    }
    setConfirmState(null);
  }, []);

  useEffect(() => {
    if (!confirmState) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") resolveConfirm(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmState, resolveConfirm]);

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm]);

  return (
    <PopupContext.Provider value={value}>
      {children}

      <div className="popup-toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`popup-toast popup-${toast.tone}`}>
            <span className="popup-symbol">{toneSymbol(toast.tone)}</span>
            <p>{toast.message}</p>
            <button
              type="button"
              aria-label="Dismiss message"
              className="popup-dismiss"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            >
              x
            </button>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="popup-confirm-overlay" onClick={() => resolveConfirm(false)}>
          <div className="popup-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className={`popup-confirm-badge popup-${confirmState.tone}`}>
              {toneSymbol(confirmState.tone)}
            </div>
            <h3>{confirmState.title}</h3>
            <p>{confirmState.message}</p>
            <div className="popup-confirm-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => resolveConfirm(false)}
              >
                {confirmState.cancelText}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => resolveConfirm(true)}
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </PopupContext.Provider>
  );
}

export function usePopup() {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error("usePopup must be used within PopupProvider");
  }
  return context;
}