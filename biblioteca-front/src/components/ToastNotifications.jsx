import { useCallback, useEffect, useRef, useState } from 'react';
import { scheduleToastLifecycle } from '../utils/toast-lifecycle';

const toastDetails = {
  success: { icon: '✓', label: 'Éxito', role: 'status' },
  info: { icon: 'i', label: 'Información', role: 'status' },
  warning: { icon: '!', label: 'Advertencia', role: 'status' },
  error: { icon: '×', label: 'Error', role: 'alert' },
};

function ToastItem({ notification, onDismiss }) {
  const [leaving, setLeaving] = useState(false);
  const lifecycle = useRef(null);
  const details = toastDetails[notification.type] || toastDetails.info;

  const dismiss = useCallback(() => lifecycle.current?.dismiss(), []);

  useEffect(() => {
    lifecycle.current = scheduleToastLifecycle({
      onLeaving: () => setLeaving(true),
      onDismiss: () => onDismiss(notification.id),
    });
    return () => lifecycle.current?.cancel();
  }, [notification.id, onDismiss]);

  return (
    <article
      className={`toast toast--${notification.type}${leaving ? ' toast--leaving' : ''}`}
      role={details.role}
      aria-label={details.label}
      onKeyDown={(event) => {
        if (event.key === 'Escape') dismiss();
      }}
    >
      <span className="toast-icon" aria-hidden="true">{details.icon}</span>
      <div className="toast-content">
        <strong>{notification.title}</strong>
        <p>{notification.message}</p>
      </div>
      <button
        className="toast-close"
        type="button"
        aria-label="Cerrar notificación"
        onClick={dismiss}
      >
        ×
      </button>
    </article>
  );
}

function ToastNotifications({ notifications, onDismiss }) {
  if (!notifications.length) return null;

  return (
    <div className="toast-viewport" aria-label="Notificaciones">
      {notifications.map((notification) => (
        <ToastItem key={notification.id} notification={notification} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export default ToastNotifications;
