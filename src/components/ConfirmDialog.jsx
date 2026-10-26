import { useState } from 'react';
import Dialog from './Dialog.jsx';

// onConfirm may throw (e.g. network); the error is shown and the dialog stays open.
export default function ConfirmDialog({ title, body, confirmLabel, cancelLabel, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog
      title={title}
      actions={
        <>
          <button
            className="btn primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await onConfirm();
              } catch {
                setError("Couldn't connect. Check your internet and try again.");
                setBusy(false);
              }
            }}
          >
            {busy && <span className="spinner" />}{confirmLabel}
          </button>
          <button className="btn" disabled={busy} onClick={onClose}>{cancelLabel}</button>
        </>
      }
    >
      {body && <p className="hint">{body}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </Dialog>
  );
}
