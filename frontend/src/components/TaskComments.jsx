import React, { useEffect, useState } from "react";
import {
  Send,
  Trash2,
  MessageSquare,
  History,
  PlusCircle,
  Play,
  CheckCircle2,
  RotateCcw,
  Pencil,
  ArrowRightLeft,
  Undo,
} from "lucide-react";
import api from "../api";
import ConfirmDialog from "./ConfirmDialog";

const ACTIVITY_ICON = {
  created: PlusCircle,
  started: Play,
  completed: CheckCircle2,
  reopened: RotateCcw,
  updated: Pencil,
  status_changed: ArrowRightLeft,
  redo: Undo,
};

export default function TaskComments({ taskId, currentUserId, currentUserRole, task }) {
  const canSeeActivity = currentUserRole === "admin";
  const [tab, setTab] = useState("comments");
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const activity = [...(task?.activity || [])].sort(
    (a, b) => new Date(b.at) - new Date(a.at)
  );

  async function load() {
    if (!taskId) return;
    try {
      const r = await api.get(`/comments/task/${taskId}`);
      setComments(r.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load comments");
    }
  }

  useEffect(() => {
    load();

    // Live comment thread — pick up new replies from the other side
    // without needing to close/reopen this modal.
    const interval = setInterval(load, 6000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setError("");

    try {
      await api.post(`/comments/task/${taskId}`, { comment: text.trim() });
      setText("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not add comment");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id) {
    try {
      await api.delete(`/comments/${id}`);
      setConfirmDeleteId(null);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || "Could not delete comment");
    }
  }

  return (
    <div className="task-comments-thread">
      {error && <div className="error">{error}</div>}

      {canSeeActivity && (
        <div className="comment-tabs">
          <button
            className={tab === "comments" ? "active" : ""}
            onClick={() => setTab("comments")}
          >
            <MessageSquare size={13} /> Comments {comments.length > 0 && `(${comments.length})`}
          </button>
          <button
            className={tab === "activity" ? "active" : ""}
            onClick={() => setTab("activity")}
          >
            <History size={13} /> Activity {activity.length > 0 && `(${activity.length})`}
          </button>
        </div>
      )}

      {(tab === "comments" || !canSeeActivity) && (
        <>
          <div className="comments">
            {comments.length === 0 ? (
              <p className="muted">No comments yet. Start the conversation.</p>
            ) : (
              comments.map((item) => (
                <div className="comment" key={item.id}>
                  <div className="comment-top">
                    <strong>
                      {item.Admin?.name || "User"}
                      {item.Admin?.role === "admin" && (
                        <span className="comment-role-tag">Admin</span>
                      )}
                    </strong>
                    <small>{new Date(item.createdAt).toLocaleString()}</small>
                  </div>

                  <p>{item.comment}</p>

                  {(currentUserRole === "admin" || item.Admin?.id === currentUserId) && (
                    <button className="btn danger small" onClick={() => setConfirmDeleteId(item.id)}>
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          <form className="comment-input-row" onSubmit={submit}>
            <textarea
              rows="2"
              placeholder="Write a comment..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="btn" disabled={loading || !text.trim()}>
              <Send size={14} />
            </button>
          </form>
        </>
      )}

      {canSeeActivity && tab === "activity" && (
        <div className="activity-timeline">
          {activity.length === 0 ? (
            <p className="muted">No activity recorded yet.</p>
          ) : (
            activity.map((entry, i) => {
              const Icon = ACTIVITY_ICON[entry.action] || Pencil;
              return (
                <div className="activity-row" key={entry._id || i}>
                  <span className={`activity-icon activity-${entry.action}`}>
                    <Icon size={13} />
                  </span>
                  <div className="activity-body">
                    <p>{entry.message}</p>
                    <small>{new Date(entry.at).toLocaleString()}</small>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete comment?"
        confirmLabel="Delete"
        onConfirm={() => remove(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
