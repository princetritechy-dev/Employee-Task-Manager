import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  List,
  Kanban,
  CalendarRange,
  Plus,
  MessageSquare,
  Users,
  Settings,
  Trash2,
} from "lucide-react";
import Layout from "../components/Layout";
import TaskBoard, { DEFAULT_COLUMNS } from "../components/TaskBoard";
import TaskCalendar from "../components/TaskCalendar";
import TaskDetail from "../components/TaskDetail";
import api from "../api";

const SWATCHES = [
  "#64748B", "#2563EB", "#DC2626", "#16A34A",
  "#EA580C", "#9333EA", "#0EA5E9", "#DB2777",
];

function makeColumn(label) {
  return {
    key: "",
    label,
    color: SWATCHES[Math.floor(Math.random() * SWATCHES.length)],
    category: "open",
    promptOnEnter: false,
  };
}

function hours(minutes) {
  const m = Number(minutes || 0);
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function ProjectDetail() {
  const { id } = useParams();
  const currentUser = JSON.parse(sessionStorage.getItem("user") || "null");
  const isAdmin = currentUser?.role === "admin";

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");
  const [view, setView] = useState("board");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showStatusManager, setShowStatusManager] = useState(false);
  const [draftColumns, setDraftColumns] = useState([]);
  const [statusError, setStatusError] = useState("");
  const [savingStatuses, setSavingStatuses] = useState(false);

  const boardColumns = project?.statusColumns?.length
    ? project.statusColumns
    : DEFAULT_COLUMNS;

  function openStatusManager() {
    setStatusError("");
    setDraftColumns(boardColumns.map((c) => ({ ...c })));
    setShowStatusManager(true);
  }

  function updateDraftColumn(index, changes) {
    setDraftColumns((cols) =>
      cols.map((c, i) => (i === index ? { ...c, ...changes } : c))
    );
  }

  function removeDraftColumn(index) {
    setDraftColumns((cols) => cols.filter((_, i) => i !== index));
  }

  function addDraftColumn() {
    setDraftColumns((cols) => [...cols, makeColumn(`Column ${cols.length + 1}`)]);
  }

  async function saveStatusColumns() {
    setStatusError("");

    if (draftColumns.some((c) => !c.label.trim())) {
      setStatusError("Every column needs a name.");
      return;
    }

    setSavingStatuses(true);
    try {
      const updated = await api.put(`/projects/${id}`, {
        statusColumns: draftColumns.map((c) => ({
          key: c.key || c.label,
          label: c.label.trim(),
          color: c.color,
          category: c.category,
          promptOnEnter: c.promptOnEnter,
        })),
      });
      setProject(updated.data);
      setShowStatusManager(false);
    } catch (err) {
      setStatusError(err.response?.data?.message || "Could not save statuses");
    } finally {
      setSavingStatuses(false);
    }
  }


  async function load() {
    try {
      const [projectsRes, tasksRes] = await Promise.all([
        api.get("/projects"),
        api.get(`/tasks/project/${id}`),
      ]);

      const found = projectsRes.data.find((p) => p.id === id);
      setProject(found || null);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
    } catch (err) {
      setTasks([]);
      setError(err.response?.data?.message || "Could not load this project");
    }
  }

  useEffect(() => {
    load();

    // Keep this project's board/list live across admin and members
    // without needing a manual reload.
    const interval = setInterval(load, 6000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (priorityFilter && (t.priority || "medium") !== priorityFilter) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (
        search &&
        !`${t.taskTitle} ${t.description || ""} ${t.Employee?.name || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [tasks, priorityFilter, statusFilter, search]);

  const totalMinutes = tasks.reduce((total, t) => total + Number(t.timeSpent || 0), 0);
  const completedCount = tasks.filter((t) => t.status === "completed").length;

  function openCard(task) {
    setEditingTask(task);
    setShowTaskModal(true);
  }

  if (error) {
    return (
      <Layout title="Project">
        <div className="error">{error}</div>
        <Link className="btn secondary" to="/projects" style={{ marginTop: "12px" }}>
          <ArrowLeft size={14} /> Back to Projects
        </Link>
      </Layout>
    );
  }

  return (
    <Layout title={project?.name || "Project"}>

      <Link to="/projects" className="back-link">
        <ArrowLeft size={14} /> All projects
      </Link>

      {project && (
        <div className="page-head">
          <div>
            <div className="project-title">
              <h1>{project.name}</h1>
              {isAdmin ? (
                <select
                  className={`status-select badge ${project.status}`}
                  value={project.status}
                  onChange={async (e) => {
                    const status = e.target.value;
                    try {
                      await api.put(`/projects/${id}`, { status });
                      load();
                    } catch (err) {
                      alert(err.response?.data?.message || "Could not update status");
                    }
                  }}
                >
                  <option value="ongoing">ongoing</option>
                  <option value="paused">paused</option>
                  <option value="completed">completed</option>
                </select>
              ) : (
                <span className={`badge ${project.status}`}>{project.status}</span>
              )}
            </div>
            {project.Client && (
              <div className="project-client">{project.Client.name}</div>
            )}
            <p className="muted">
              {project.description || "No description"}
            </p>
            <small className="muted">
              {project.startDate || "No start date"} → {project.endDate || "No end date"}
            </small>
          </div>

          {(project.Users || []).length > 0 && (
            <div className="assignee-avatars project-members" title={project.Users.map((u) => u.name).join(", ")}>
              <Users size={14} className="muted" />
              {project.Users.slice(0, 6).map((u) => (
                <span className="mini-avatar" key={u.id}>
                  {u.name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="stats">
        <div className="stat">
          <span>Total tasks</span>
          <strong>{tasks.length}</strong>
        </div>
        <div className="stat">
          <span>Completed</span>
          <strong>{completedCount}</strong>
        </div>
        <div className="stat">
          <span>Total time logged</span>
          <strong>{hours(totalMinutes)}</strong>
        </div>
      </div>

      <div className="card">

        <div className="tasks-header">
          <div className="tasks-header-info">
            <h2>Tasks</h2>
            <p className="muted">
              {filteredTasks.length} of {tasks.length} shown
              {!isAdmin && " · only tasks assigned to you"}
            </p>
          </div>

          <div className="tasks-header-actions">
            {isAdmin && (
              <button className="btn secondary" onClick={openStatusManager}>
                <Settings size={16} /> Manage Statuses
              </button>
            )}
            <button
              className="btn"
              onClick={() => {
                setEditingTask(null);
                setShowTaskModal(true);
              }}
            >
              <Plus size={16} /> Add Task
            </button>
          </div>
        </div>

        <div className="view-toolbar">
          <div className="view-switcher">
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
              <List size={14} /> List
            </button>
            <button className={view === "board" ? "active" : ""} onClick={() => setView("board")}>
              <Kanban size={14} /> Board
            </button>
            <button className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")}>
              <CalendarRange size={14} /> Calendar
            </button>
          </div>

          <div className="view-filters">
            <input
              className="filter-search"
              placeholder="Search tasks or member..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {boardColumns.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {view === "board" && (
          <TaskBoard
            tasks={filteredTasks}
            onChanged={load}
            onEdit={openCard}
            mode={isAdmin ? "admin" : "member"}
            currentUserId={currentUser?.id}
            columns={boardColumns}
          />
        )}

        {view === "calendar" && (
          <TaskCalendar tasks={filteredTasks} onEdit={openCard} mode="member" />
        )}

        {view === "list" && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Owner</th>
                  <th>Priority</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Comments</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <div className="task-title-row">
                        <span className={`priority-dot priority-${task.priority || "medium"}`} />
                        <strong>{task.taskTitle}</strong>
                      </div>
                      {task.tags?.length > 0 && (
                        <div className="tag-chip-row small">
                          {task.tags.map((tag) => (
                            <span className="tag-chip small" key={tag}>{tag}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>{task.Employee?.name || "-"}</td>
                    <td>
                      <span className={`priority-badge priority-${task.priority || "medium"}`}>
                        {task.priority || "medium"}
                      </span>
                    </td>
                    <td>{task.dueDate || "-"}</td>
                    <td>
                      <span className="status-badge status-active">
                        <span className="status-dot" />
                        {boardColumns.find((c) => c.key === task.status)?.label || task.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>{hours(task.timeSpent)}</td>
                    <td>
                      <button className="btn small secondary" onClick={() => setCommentTask(task)}>
                        <MessageSquare size={12} /> {task.Comments?.length || 0}
                      </button>
                    </td>
                  </tr>
                ))}

                {!filteredTasks.length && (
                  <tr>
                    <td colSpan="7" className="empty">
                      {tasks.length ? "No tasks match your filters." : "No tasks in this project yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {showTaskModal && (
        <TaskDetail
          task={editingTask}
          currentUser={currentUser}
          defaultProjectId={id}
          lockProject
          onSaved={() => {
            load();
            setShowTaskModal(false);
            setEditingTask(null);
          }}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTask(null);
          }}
        />
      )}

      {showStatusManager && (
        <div className="modal-overlay" onClick={() => setShowStatusManager(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Manage Statuses</h2>
                <p className="muted">Custom Kanban columns for this project</p>
              </div>
              <button className="close-btn" onClick={() => setShowStatusManager(false)}>
                ×
              </button>
            </div>

            {statusError && <div className="error">{statusError}</div>}

            {draftColumns.map((col, i) => (
              <div className="status-col-row" key={i}>
                <span className="kanban-color-dot" style={{ background: col.color, flexShrink: 0 }} />

                <input
                  type="text"
                  value={col.label}
                  onChange={(e) => updateDraftColumn(i, { label: e.target.value })}
                  placeholder="Column name"
                />

                <select
                  value={col.category}
                  onChange={(e) => updateDraftColumn(i, { category: e.target.value })}
                  title="What this column means for time tracking"
                >
                  <option value="open">Not started</option>
                  <option value="active">Active (starts timer)</option>
                  <option value="done">Done (stops timer)</option>
                </select>

                <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", whiteSpace: "nowrap" }}>
                  <input
                    type="checkbox"
                    checked={col.promptOnEnter}
                    onChange={(e) => updateDraftColumn(i, { promptOnEnter: e.target.checked })}
                  />
                  Ask why
                </label>

                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => removeDraftColumn(i)}
                  disabled={draftColumns.length <= 1}
                >
                  <Trash2 size={14} />
                </button>

                <div className="color-swatch-row">
                  {SWATCHES.map((sw) => (
                    <span
                      key={sw}
                      className={`color-swatch ${col.color === sw ? "selected" : ""}`}
                      style={{ background: sw }}
                      onClick={() => updateDraftColumn(i, { color: sw })}
                    />
                  ))}
                </div>
              </div>
            ))}

            <button type="button" className="btn secondary" onClick={addDraftColumn}>
              <Plus size={14} /> Add column
            </button>

            <div className="form-actions" style={{ marginTop: "16px" }}>
              <button className="btn" onClick={saveStatusColumns} disabled={savingStatuses}>
                {savingStatuses ? "Saving..." : "Save Statuses"}
              </button>
              <button type="button" className="btn secondary" onClick={() => setShowStatusManager(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
