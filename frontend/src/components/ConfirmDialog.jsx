import React from "react";

/*
|--------------------------------------------------------------------------
| ConfirmDialog — replaces window.confirm() everywhere
|--------------------------------------------------------------------------
| Usage:
|   const [confirming, setConfirming] = useState(null); // holds context data or null
|   <ConfirmDialog
|     open={!!confirming}
|     title="Delete this task?"
|     message="This can't be undone."
|     onConfirm={() => { doTheThing(confirming); setConfirming(null); }}
|     onCancel={() => setConfirming(null)}
|   />
|--------------------------------------------------------------------------
*/

export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal small-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>

        {message && <p className="muted">{message}</p>}

        <div className="form-actions" style={{ marginTop: "14px" }}>
          <button className={`btn ${danger ? "danger" : ""}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button className="btn secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
