import { useEffect, useRef } from 'react';

function ConfirmationDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  busyLabel = 'Procesando…',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="confirmation-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirmation-dialog-title"
      aria-describedby="confirmation-dialog-message"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          if (!busy) onCancel();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="confirmation-dialog-content">
        <p className="eyebrow">CONFIRMAR ACCIÓN</p>
        <h2 id="confirmation-dialog-title">{title}</h2>
        <p id="confirmation-dialog-message">{message}</p>
        <div className="confirmation-dialog-actions">
          <button className="button button--outline" type="button" onClick={onCancel} disabled={busy} autoFocus>
            Cancelar
          </button>
          <button className="button button--danger" type="button" onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default ConfirmationDialog;
