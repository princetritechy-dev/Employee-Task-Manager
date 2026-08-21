import React, { useEffect, useState } from "react";
import {
  Plus,
  FolderKanban,
  Clock3,
  CalendarDays,
  FileText,
  UserPen,
} from "lucide-react";
import api from "../api";

const today = () =>
  new Date().toISOString().slice(0, 10);

export default function TaskForm({   onSaved,
  editingTask,
  setEditingTask }) {
  const [projects, setProjects] = useState([]);

  const [form, setForm] = useState({
    projectId: "",
    taskTitle: "",
    description: "",
    assignedBy: "",
    timeSpent: 60,
    taskDate: today(),
  });

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/projects").then((r) => {
      setProjects(r.data);
    });
  }, []);

  useEffect(() => {
  if (editingTask) {
    setForm({
      projectId: editingTask.projectId || "",
      taskTitle: editingTask.taskTitle || "",
      description: editingTask.description || "",
      assignedBy: editingTask.assignedBy || "",
      timeSpent: editingTask.timeSpent || 60,
      taskDate: editingTask.taskDate || today(),
    });
  }
}, [editingTask]);

  function change(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function submit(e) {
    e.preventDefault();

    setError("");
    setSaving(true);

    try {
      const data = {
        ...form,
        projectId: form.projectId,
        timeSpent: Number(form.timeSpent),
      };

      if (editingTask) {
        await api.put(`/tasks/${editingTask.id}`, data);
      } else {
        await api.post("/tasks", data);
      }
      setForm({
        projectId: "",
        taskTitle: "",
        description: "",
        assignedBy: "",
        timeSpent: 60,
        taskDate: today(),
      });

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

  return (
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
      </div>

      {error && (
        <div className="error">
          {error}
        </div>
      )}

      <div className="form-field">

        <label>
          <FolderKanban size={14} />
          Project
        </label>

        <select
          name="projectId"
          value={form.projectId}
          onChange={change}
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

      <div className="form-field">

        <label>Description</label>

        <textarea
          name="description"
          value={form.description}
          onChange={change}
          rows="4"
          placeholder="Describe what you worked on..."
        />

      </div>

      <div className="form-field">

        <label>
          <UserPen size={14} />
          Assigned by
        </label>

        <input
          name="assignedBy"
          value={form.assignedBy}
          onChange={change}
          placeholder="e.g. Sourav Sobti"
        />

      </div>

      <div className="grid two">

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

    </form>
  );
}