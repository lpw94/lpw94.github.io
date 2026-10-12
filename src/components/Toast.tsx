import { useSyncExternalStore } from 'react'
import { subscribeToasts, getToasts } from '../lib/toast'

export default function ToastHost() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts)
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' && (
            <span className="toast-icon" aria-hidden>
              ✓
            </span>
          )}
          {t.type === 'error' && (
            <span className="toast-icon" aria-hidden>
              !
            </span>
          )}
          <span className="toast-msg">{t.message}</span>
        </div>
      ))}
    </div>
  )
}
