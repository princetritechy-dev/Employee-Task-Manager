import React, { useEffect, useState } from "react";
import {
  Plus,
  FolderKanban,
  Clock3,
  CalendarDays,
  FileText,
  UserPen,
  Flag,
  Tag,
  ListChecks,
  X,
  Users,
  Timer,
  Repeat,
  Link2,
} from "lucide-react";
import api from "../api";

const today = () =>
  new Date().toISOString().slice(0, 10);

const emptyForm = () => ({
  projectId: "",
  taskTitle: "",
  description: "",
  assignedBy: "",
  timeSpent: 60,
  taskDate: today(),
  priority: "medium",
  dueDate: "",
  tags: [],
  subtasks: [],
  assigneeIds: [],
  estimateMinutes: "",
  repeat: "none",
  blockedBy: [],
  forUserId: "",
});

export default function TaskForm({   onSaved,
  editingTask,
  setEditingTask,
  onCancel,
  defaultProjectId,
  lockProject }) {
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [dependencyOptions, setDependencyOptions] = useState([]);

  const currentUser = JSON.parse(sessionStorage.getItem("user") || "null");
  const readOnly =
  !!editingTask &&
  currentUser?.role !== "admin" &&
  editingTask.isLocked;

  const [form, setForm] = useState(() => ({
    ...emptyForm(),
    projectId: defaultProjectId || "",
  }));
  const [tagInput, setTagInput] = useState("");
  const [subtaskInput, setSubtaskInput] = useState("");

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingNewMembers, setPendingNewMembers] = useState(null);
  const [logTimeInput, setLogTimeInput] = useState("");
  const [loggingTime, setLoggingTime] = useState(false);
  const [logTimeError, setLogTimeError] = useState("");

  function parseDuration(text) {
    const trimmed = text.trim().toLowerCase();
    if (!trimmed) return null;

    // Plain number = minutes
    if (/^\d+$/.test(trimmed)) return Number(trimmed);

    const hMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*h/);
    const mMatch = trimmed.match(/(\d+)\s*m/);

    if (!hMatch && !mMatch) return null;

    const hours = hMatch ? parseFloat(hMatch[1]) : 0;
    const mins = mMatch ? parseInt(mMatch[1], 10) : 0;

    return Math.round(hours * 60 + mins);
  }

  async function submitLogTime() {
    const minutes = parseDuration(logTimeInput);

    if (!minutes || minutes <= 0) {
      setLogTimeError("Try a format like \"1h 30m\", \"45m\", or just a number of minutes");
      return;
    }

    setLogTimeError("");
    setLoggingTime(true);

    try {
      const res = await api.patch(`/tasks/${editingTask.id}/log-time`, { minutes });
      setForm((f) => ({ ...f, timeSpent: res.data.task.timeSpent }));
      setLogTimeInput("");
    } catch (err) {
      setLogTimeError(err.response?.data?.message || "Could not log time");
    } finally {
      setLoggingTime(false);
    }
  }

  useEffect(() => {
    api.get("/projects").then((r) => {
      setProjects(r.data);
    });

    // Admins can assign any employee, not just current project members —
    // assigning someone outside the project auto-adds them (like ClickUp).
    if (currentUser?.role === "admin") {
      api.get("/admin/employees").then((r) => {
        setAllEmployees(r.data);
      }).catch(() => setAllEmployees([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The people selectable as owner/assignees: every employee for an admin
  // (since assigning auto-adds them to the project), current project
  // members only for a regular employee creating their own task.
  const assigneePool =
    currentUser?.role === "admin" && allEmployees.length
      ? allEmployees
      : members;

  useEffect(() => {
  if (editingTask) {
    setForm({
      projectId: editingTask.projectId || "",
      taskTitle: editingTask.taskTitle || "",
      description: editingTask.description || "",
      assignedBy: editingTask.assignedBy || "",
      timeSpent: editingTask.timeSpent || 60,
      taskDate: editingTask.taskDate || today(),
      priority: editingTask.priority || "medium",
      dueDate: editingTask.dueDate || "",
      tags: editingTask.tags || [],
      subtasks: editingTask.subtasks || [],
      assigneeIds: editingTask.assigneeIds || [],
      estimateMinutes: editingTask.estimateMinutes || "",
      repeat: editingTask.repeat || "none",
      blockedBy: editingTask.blockedBy || [],
    });
  }
}, [editingTask]);

  /* ---------------------------------------------------------------------
     PROJECT MEMBERS (assignee pool) + DEPENDENCY CANDIDATES
     Both are scoped to the selected project. Members come straight off
     the project record; other tasks in the project come from whichever
     "list tasks" endpoint this user has access to.
  --------------------------------------------------------------------- */

  useEffect(() => {
    if (!form.projectId) {
      setMembers([]);
      setDependencyOptions([]);
      return;
    }

    const project = projects.find((p) => p.id === form.projectId);
    setMembers(project?.Users || []);

    const endpoint =
      currentUser?.role === "admin"
        ? `/tasks/admin/all?projectId=${form.projectId}`
        : "/tasks/my";

    api
      .get(endpoint)
      .then((r) => {
        const list = r.data.filter(
          (t) =>
            t.projectId === form.projectId &&
            t.id !== editingTask?.id
        );
        setDependencyOptions(list);
      })
      .catch(() => setDependencyOptions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.projectId, projects]);

  function change(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function toggleAssignee(userId) {
    setForm({
      ...form,
      assigneeIds: form.assigneeIds.includes(userId)
        ? form.assigneeIds.filter((id) => id !== userId)
        : [...form.assigneeIds, userId],
    });
  }

  function toggleDependency(taskId) {
    setForm({
      ...form,
      blockedBy: form.blockedBy.includes(taskId)
        ? form.blockedBy.filter((id) => id !== taskId)
        : [...form.blockedBy, taskId],
    });
  }

  /* ---------------------------------------------------------------------
     TAGS
  --------------------------------------------------------------------- */

  function addTag(e) {
    e.preventDefault();
    const value = tagInput.trim();
    if (!value) return;
    if (!form.tags.includes(value)) {
      setForm({ ...form, tags: [...form.tags, value] });
    }
    setTagInput("");
  }

  function removeTag(tag) {
    setForm({
      ...form,
      tags: form.tags.filter((t) => t !== tag),
    });
  }

  /* ---------------------------------------------------------------------
     SUBTASKS
  --------------------------------------------------------------------- */

  function addSubtask(e) {
    e.preventDefault();
    const value = subtaskInput.trim();
    if (!value) return;
    setForm({
      ...form,
      subtasks: [...form.subtasks, { title: value, completed: false }],
    });
    setSubtaskInput("");
  }

  function removeSubtask(index) {
    setForm({
      ...form,
      subtasks: form.subtasks.filter((_, i) => i !== index),
    });
  }

  function toggleSubtaskDraft(index) {
    setForm({
      ...form,
      subtasks: form.subtasks.map((s, i) =>
        i === index ? { ...s, completed: !s.completed } : s
      ),
    });
  }

  async function performSubmit() {
    setError("");
    setSaving(true);

    try {
      const data = {
        ...form,
        projectId: form.projectId,
        timeSpent: Number(form.timeSpent),
        dueDate: form.dueDate || null,
        estimateMinutes: form.estimateMinutes ? Number(form.estimateMinutes) : 0,
      };

      if (editingTask) {
        await api.put(`/tasks/${editingTask.id}`, data);
      } else {
        await api.post("/tasks", data);
      }
      setForm({ ...emptyForm(), projectId: defaultProjectId || "" });
      setTagInput("");
      setSubtaskInput("");

      setEditingTask?.(null);

      onSaved?.();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not save task"
      );
    } finally {
      setSaving(false);
    }
  }

  function submit(e) {
    e.preventDefault();

    // Admin-only check: warn (rather than silently add) when the chosen
    // owner/assignees aren't already project members — same idea as
    // ClickUp's "this isn't in the list yet, add them?" pattern.
    if (currentUser?.role === "admin") {
      const memberIds = new Set(members.map((m) => m.id));
      const candidates = [
        ...(form.forUserId ? [form.forUserId] : []),
        ...form.assigneeIds,
      ];

      const newOnes = [...new Set(candidates)]
        .filter((id) => !memberIds.has(id))
        .map((id) => assigneePool.find((p) => p.id === id))
        .filter(Boolean);

      if (newOnes.length > 0) {
        setPendingNewMembers(newOnes);
        return;
      }
    }

    performSubmit();
  }

  return (
    <>
    <form className="card task-form" onSubmit={submit}>

      <div className="form-heading">
        <div className="form-icon">
          {editingTask ? (
            <FileText size={20} />
          ) : (
            <Plus size={20} />
          )}
        </div>

        <div>
          <h2>
            {editingTask ? "Edit Task" : "Add Daily Task"}
          </h2>
          <p className="muted">
            Record the work you completed today.
          </p>
        </div>

        {onCancel && (
          <button
            type="button"
            className="close-btn"
            onClick={onCancel}
          >
            ×
          </button>
        )}
      </div>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      {readOnly && (
        <div className="readonly-note">
          Only admins can edit task details. You can still view everything below, log time, and use Comments/Activity on the right.
        </div>
      )}

      <fieldset disabled={readOnly} className="task-form-fieldset">

      <div className="grid two">

        <div className="form-field">

          <label>
            <FolderKanban size={14} />
            Project
          </label>

          <select
            name="projectId"
            value={form.projectId}
            onChange={change}
            disabled={!!lockProject}
            required
          >
            <option value="">
              Select project
            </option>

            {projects
              .filter(
                (p) => p.status !== "completed"
              )
              .map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                >
                  {p.name} ({p.status})
                </option>
              ))}
          </select>

        </div>

        <div className="form-field">

          <label>
            <FileText size={14} />
            Task title
          </label>

          <input
            name="taskTitle"
            value={form.taskTitle}
            onChange={change}
            placeholder="e.g. Build employee dashboard"
            required
          />

        </div>

      </div>

      <div className="form-field">

        <label>Description</label>

        <textarea
          name="description"
          value={form.description}
          onChange={change}
          rows="3"
          placeholder="Describe what you worked on..."
        />

      </div>

      <div className="grid two">

        <div className="form-field">

          <label>
            <UserPen size={14} />
            Assigned by
          </label>

          <input
            name="assignedBy"
            value={form.assignedBy}
            onChange={change}
            placeholder="e.g. Person Name"
          />

        </div>

        <div className="form-field">

          <label>
            <CalendarDays size={14} />
            Task date
          </label>

          <input
            type="date"
            name="taskDate"
            value={form.taskDate}
            onChange={change}
            required
          />

        </div>

      </div>

      <div className="form-field">

        <label>
          <Clock3 size={14} />
          Time spent
        </label>

        <div className="input-with-suffix">

          <input
            type="number"
            min="1"
            max="1440"
            name="timeSpent"
            value={form.timeSpent}
            onChange={change}
            required
          />

          <span>minutes</span>

        </div>

      </div>

      <div className="grid two">

        <div className="form-field">

          <label>
            <Flag size={14} />
            Priority
          </label>

          <select
            name="priority"
            value={form.priority}
            onChange={change}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

        </div>

        <div className="form-field">

          <label>
            <CalendarDays size={14} />
            Due date
          </label>

          <input
            type="date"
            name="dueDate"
            value={form.dueDate}
            onChange={change}
          />

        </div>

      </div>

      <div className="grid two">

        <div className="form-field">

          <label>
            <Timer size={14} />
            Time estimate
          </label>

          <div className="input-with-suffix">
            <input
              type="number"
              min="0"
              max="10080"
              name="estimateMinutes"
              value={form.estimateMinutes}
              onChange={change}
              placeholder="Optional"
            />
            <span>minutes</span>
          </div>

        </div>

        <div className="form-field">

          <label>
            <Repeat size={14} />
            Repeat
          </label>

          <select
            name="repeat"
            value={form.repeat}
            onChange={change}
          >
            <option value="none">Doesn't repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>

        </div>

      </div>

      {form.projectId && currentUser?.role === "admin" && !editingTask && (
        <div className="form-field">

          <label>
            <UserPen size={14} />
            Assign to
          </label>

          <select
            value={form.forUserId}
            onChange={(e) => setForm({ ...form, forUserId: e.target.value })}
          >
            <option value="">Myself ({currentUser?.name})</option>
            {assigneePool.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <p className="muted small-note">
            This task will appear directly on their dashboard. If they
            aren't already on this project, we'll ask you to confirm before adding them.
          </p>

        </div>
      )}

      {form.projectId && (
        <div className="form-field">

          <label>
            <Users size={14} />
            Assignees
          </label>

          {assigneePool.length > 0 ? (
            <div className="checkbox-pill-row">
              {assigneePool.map((m) => (
                <label
                  key={m.id}
                  className={`checkbox-pill ${form.assigneeIds.includes(m.id) ? "checked" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={form.assigneeIds.includes(m.id)}
                    onChange={() => toggleAssignee(m.id)}
                  />
                  {m.name}
                </label>
              ))}
            </div>
          ) : (
            <p className="muted small-note">
              This project has no other members to assign yet.
            </p>
          )}

        </div>
      )}

      {form.projectId && dependencyOptions.length > 0 && (
        <div className="form-field">

          <label>
            <Link2 size={14} />
            Blocked by
          </label>

          <div className="checkbox-pill-row">
            {dependencyOptions.map((t) => (
              <label
                key={t.id}
                className={`checkbox-pill ${form.blockedBy.includes(t.id) ? "checked" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={form.blockedBy.includes(t.id)}
                  onChange={() => toggleDependency(t.id)}
                />
                {t.taskTitle}
              </label>
            ))}
          </div>

        </div>
      )}

      <div className="form-field">

        <label>
          <Tag size={14} />
          Tags
        </label>

        <div className="tag-input-row">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTag(e);
            }}
            placeholder="e.g. frontend, urgent — press Enter"
          />
          <button className="btn secondary" onClick={addTag} type="button">
            Add
          </button>
        </div>

        {form.tags.length > 0 && (
          <div className="tag-chip-row">
            {form.tags.map((tag) => (
              <span className="tag-chip" key={tag}>
                {tag}
                <X size={12} onClick={() => !readOnly && removeTag(tag)} />
              </span>
            ))}
          </div>
        )}

      </div>

      <div className="form-field">

        <label>
          <ListChecks size={14} />
          Subtasks / checklist
        </label>

        <div className="tag-input-row">
          <input
            value={subtaskInput}
            onChange={(e) => setSubtaskInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addSubtask(e);
            }}
            placeholder="e.g. Write unit tests — press Enter"
          />
          <button className="btn secondary" onClick={addSubtask} type="button">
            Add
          </button>
        </div>

        {form.subtasks.length > 0 && (
          <ul className="subtask-draft-list">
            {form.subtasks.map((s, i) => (
              <li key={i}>
                <label>
                  <input
                    type="checkbox"
                    checked={s.completed}
                    onChange={() => toggleSubtaskDraft(i)}
                  />
                  <span className={s.completed ? "done" : ""}>{s.title}</span>
                </label>
                <X size={14} onClick={() => !readOnly && removeSubtask(i)} />
              </li>
            ))}
          </ul>
        )}

      </div>

      </fieldset>

      {editingTask && (
        <div className="form-field">
          <label>
            <Clock3 size={14} />
            Log time
          </label>
          <div className="log-time-row">
            <input
              type="text"
              value={logTimeInput}
              onChange={(e) => setLogTimeInput(e.target.value)}
              placeholder="e.g. 1h 30m or 45m"
            />
            <button
              type="button"
              className="btn secondary"
              onClick={submitLogTime}
              disabled={loggingTime || !logTimeInput.trim()}
            >
              {loggingTime ? "Logging..." : "Log time"}
            </button>
          </div>
          {logTimeError && <span className="field-error">{logTimeError}</span>}
        </div>
      )}

      <div className="form-actions">

        {!readOnly && (
          <button
            className="btn"
            disabled={saving}
          >
            <Plus size={16} />

            {saving
            ? "Saving..."
            : editingTask
              ? "Update Task"
              : "Add Task"}
          </button>
        )}

        {onCancel && (
          <button
            type="button"
            className="btn secondary"
            onClick={onCancel}
          >
            {readOnly ? "Close" : "Cancel"}
          </button>
        )}

      </div>

    </form>

    {pendingNewMembers && (
      <div className="modal-overlay" onClick={() => setPendingNewMembers(null)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div>
              <h2>Add to project?</h2>
              <p>They aren't a member of this project yet.</p>
            </div>
            <button
              type="button"
              className="close-btn"
              onClick={() => setPendingNewMembers(null)}
            >
              ×
            </button>
          </div>

          <div className="tag-chip-row">
            {pendingNewMembers.map((p) => (
              <span className="tag-chip" key={p.id}>{p.name}</span>
            ))}
          </div>

          <p className="muted" style={{ marginTop: "12px" }}>
            Saving this task will add {pendingNewMembers.length === 1 ? "them" : "them all"} to
            the project so they can see and work on it.
          </p>

          <div className="form-actions" style={{ marginTop: "14px" }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setPendingNewMembers(null);
                performSubmit();
              }}
            >
              Add them &amp; Save Task
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setPendingNewMembers(null)}
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