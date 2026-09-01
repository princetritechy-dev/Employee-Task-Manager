import React, { useEffect, useState } from "react";
import { Calendar, GripVertical, ListChecks, Lock, AlertTriangle, Repeat } from "lucide-react";
import AvatarDisplay from "./AvatarDisplay";
import api from "../api";

export const DEFAULT_COLUMNS = [
  { key: "pending", label: "Open", color: "#64748B", category: "open", promptOnEnter: false },
  { key: "in_progress", label: "In Progress", color: "#2563EB", category: "active", promptOnEnter: false },
  { key: "in_review", label: "In Review", color: "#F59E0B", category: "open", promptOnEnter: false },
  { key: "redo", label: "Redo", color: "#DC2626", category: "open", promptOnEnter: true },
  { key: "completed", label: "Completed", color: "#16A34A", category: "done", promptOnEnter: false },
];

const PRIORITY_LABEL = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

function subtaskProgress(task) {
  const subtasks = task.subtasks || [];
  if (!subtasks.length) return null;
  const done = subtasks.filter((s) => s.completed).length;
  return { done, total: subtasks.length };
}

export default function TaskBoard({
  tasks,
  onChanged,
  onEdit,
  mode = "employee",
  currentUserId,
  columns: columnDefs = DEFAULT_COLUMNS,
}) {
  const [dragTaskId, setDragTaskId] = useState(null);
  const [overColumn, setOverColumn] = useState(null);
  const [reasonPrompt, setReasonPrompt] = useState(null); // { task, column }
  const [reasonText, setReasonText] = useState("");

  // Optimistic status overrides, keyed by task id — NOT a full local copy
  // of `tasks`. A plain local copy gets clobbered the moment the parent's
  // background poll resolves with data it fetched *before* our move landed,
  // which snaps the card back to its old column for a moment (the exact
  // "completed, then progress" flicker). Instead we keep a small override
  // map that wins over whatever `tasks` says, and only clear an entry once
  // the parent's own data actually agrees with us — self-healing, so it
  // can never be stale-overwritten mid-flight.
  const [pendingMoves, setPendingMoves] = useState({});

  useEffect(() => {
    setPendingMoves((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const taskId of Object.keys(next)) {
        const serverTask = tasks.find((t) => t.id === taskId);
        if (serverTask && serverTask.status === next[taskId]) {
          delete next[taskId];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tasks]);

  const displayTasks = tasks.map((t) =>
    pendingMoves[t.id] ? { ...t, status: pendingMoves[t.id] } : t
  );

  // Any task whose status doesn't match a defined column still needs to be
  // visible somewhere, rather than silently disappearing from the board.
  const knownKeys = new Set(columnDefs.map((c) => c.key));
  const orphanTasks = displayTasks.filter((t) => !knownKeys.has(t.status));

  const effectiveColumns = orphanTasks.length
    ? [...columnDefs, { key: "__other__", label: "Other", color: "#94A3B8", category: "open", promptOnEnter: false }]
    : columnDefs;

  const columns = effectiveColumns.map((col) => ({
    ...col,
    tasks: (col.key === "__other__" ? orphanTasks : displayTasks.filter((t) => t.status === col.key))
      .sort((a, b) => (a.order || 0) - (b.order || 0)),
  }));

  function ownsTask(task) {
    return !currentUserId || task.userId === currentUserId;
  }

  async function moveTask(task, column, reason) {
    if (task.status === column.key) return;

    // Optimistic: mark this task as moved right away. It stays this way
    // regardless of what any in-flight poll returns, until the parent's
    // `tasks` prop itself reports the new status back to us above.
    setPendingMoves((prev) => ({ ...prev, [task.id]: column.key }));

    try {
      await api.patch(`/tasks/${task.id}/move`, {
        statusKey: column.key,
        reason,
      });
      onChanged?.();
    } catch (err) {
      // The move didn't actually happen server-side — drop the override
      // so the card falls back to its real (unmoved) column.
      setPendingMoves((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
      alert(
        err.response?.data?.message || "Could not move task"
      );
    }
  }

  function handleDrop(e, column) {
    e.preventDefault();
    setOverColumn(null);

    const task = displayTasks.find((t) => t.id === dragTaskId);
    setDragTaskId(null);

    if (!task || column.key === "__other__") return;

    if (mode === "member" && !ownsTask(task)) return;

    if (column.promptOnEnter) {
      setReasonText("");
      setReasonPrompt({ task, column });
      return;
    }

    moveTask(task, column);
  }

  async function confirmReason() {
    const { task, column } = reasonPrompt;
    setReasonPrompt(null);
    await moveTask(task, column, reasonText.trim());
  }

  return (
    <>
    <div className="kanban-board">
      {columns.map((col) => (
        <div
          key={col.key}
          className={`kanban-column ${overColumn === col.key ? "drag-over" : ""}`}
          data-col={col.key}
          style={{ "--col-color": col.color }}
          onDragOver={(e) => {
            e.preventDefault();
            setOverColumn(col.key);
          }}
          onDragLeave={() => setOverColumn(null)}
          onDrop={(e) => handleDrop(e, col)}
        >
          <div className="kanban-column-head">
            <span className="kanban-column-title">
              <span className="kanban-color-dot" style={{ background: col.color }} />
              {col.label}
            </span>
            <span className="kanban-count">{col.tasks.length}</span>
          </div>

          <div className="kanban-cards">
            {col.tasks.map((task) => {
              const progress = subtaskProgress(task);
              const draggable = mode !== "member" || ownsTask(task);

              return (
                <div
                  key={task.id}
                  className={`kanban-card ${!draggable ? "kanban-card-readonly" : ""} ${dragTaskId === task.id ? "kanban-card-dragging" : ""}`}
                  draggable={draggable}
                  onDragStart={() => draggable && setDragTaskId(task.id)}
                  onDragEnd={() => setDragTaskId(null)}
                  onClick={() => onEdit?.(task)}
                >
                  <div className="kanban-card-top">
                    <GripVertical size={13} className="grip" />
                    <span className={`priority-badge priority-${task.priority || "medium"}`}>
                      {PRIORITY_LABEL[task.priority] || "Medium"}
                    </span>
                    {task.isLocked && <Lock size={12} className="lock-icon" />}
                  </div>

                  <strong className="kanban-card-title">
                    {task.taskTitle}
                  </strong>

                  <div className="kanban-card-project muted">
                    {task.Project?.name || "-"}
                  </div>

                  {(mode === "admin" || mode === "member") && (
                    <div className="kanban-card-assignee">
                      <AvatarDisplay avatarId={task.Employee?.avatarId} name={task.Employee?.name} size={18} />
                      {task.Employee?.name || "Unknown"}
                    </div>
                  )}

                  {task.Assignees?.length > 0 && (
                    <div className="assignee-avatars" title={task.Assignees.map((a) => a.name).join(", ")}>
                      {task.Assignees.slice(0, 4).map((a) => (
                        <AvatarDisplay
                          key={a.id}
                          avatarId={a.avatarId}
                          name={a.name}
                          size={18}
                          className="mini-avatar"
                        />
                      ))}
                    </div>
                  )}

                  {task.tags?.length > 0 && (
                    <div className="tag-chip-row small">
                      {task.tags.map((tag) => (
                        <span className="tag-chip" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="kanban-card-foot">
                    {task.dueDate && (
                      <span className="kanban-meta">
                        <Calendar size={12} />
                        {task.dueDate}
                      </span>
                    )}

                    {progress && (
                      <span className="kanban-meta">
                        <ListChecks size={12} />
                        {progress.done}/{progress.total}
                      </span>
                    )}

                    {task.estimateMinutes > 0 && (
                      <span className="kanban-meta">
                        Est {Math.round(task.estimateMinutes / 60 * 10) / 10}h
                      </span>
                    )}
                  </div>

                  <div className="kanban-card-foot">
                    {task.Blockers?.some((b) => b.status !== "completed") && (
                      <span className="blocked-badge">
                        <AlertTriangle size={11} /> Blocked
                      </span>
                    )}

                    {task.repeat && task.repeat !== "none" && (
                      <span className="recurring-badge">
                        <Repeat size={11} /> {task.repeat}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {!col.tasks.length && (
              <div className="kanban-empty">
                {col.key === "__other__" ? "—" : "Drop tasks here"}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>

    {reasonPrompt && (
      <div className="modal-overlay" onClick={() => setReasonPrompt(null)}>
        <div className="modal redo-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <h2>Move to {reasonPrompt.column.label}?</h2>
              <p><strong>{reasonPrompt.task.taskTitle}</strong></p>
            </div>
            <button
              type="button"
              className="close-btn"
              onClick={() => setReasonPrompt(null)}
            >
              ×
            </button>
          </div>

          <label>What needs fixing? (optional)</label>
          <textarea
            rows="3"
            autoFocus
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="e.g. Colors don't match the brand guide"
          />

          <div className="form-actions" style={{ marginTop: "14px" }}>
            <button className="btn danger" onClick={confirmReason}>
              Move to {reasonPrompt.column.label}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setReasonPrompt(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}