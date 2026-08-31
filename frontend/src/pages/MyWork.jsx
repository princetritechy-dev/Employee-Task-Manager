import React, { useEffect, useMemo, useState } from "react";
import { List, Kanban, CalendarRange, Briefcase, MessageSquare } from "lucide-react";
import Layout from "../components/Layout";
import TaskBoard from "../components/TaskBoard";
import TaskCalendar from "../components/TaskCalendar";
import TaskDetail from "../components/TaskDetail";
import api from "../api";

function hours(minutes) {
  const m = Number(minutes || 0);
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function MyWork() {
  const currentUser = JSON.parse(sessionStorage.getItem("user") || "null");

  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");
  const [view, setView] = useState("board");
  const [openTask, setOpenTask] = useState(null);

  async function load() {
    try {
      const r = await api.get("/tasks/assigned-to-me");
      setTasks(Array.isArray(r.data) ? r.data : []);
      setError(Array.isArray(r.data) ? "" : "Unexpected response loading your work");
    } catch (err) {
      setTasks([]);
      setError(err.response?.data?.message || "Could not load your work");
    }
  }

  useEffect(() => {
    load();

    // Keep this view live — pick up newly assigned/updated tasks without
    // needing a manual reload.
    const interval = setInterval(load, 6000);
    return () => clearInterval(interval);
  }, []);

  const safeTasks = Array.isArray(tasks) ? tasks : [];

  const ownedCount = safeTasks.filter((t) => t.userId === currentUser?.id).length;
  const assignedCount = safeTasks.length - ownedCount;

  const openMinutesEstimate = useMemo(
    () =>
      safeTasks
        .filter((t) => t.status !== "completed")
        .reduce((total, t) => total + Number(t.estimateMinutes || 0), 0),
    [safeTasks]
  );

  return (
    <Layout title="My Work">

      <div className="page-head">
        <div>
          <h1>My Work</h1>
          <p className="muted">
            Every task assigned to you, across every project.
          </p>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="stats">
        <div className="stat">
          <span>Total assigned</span>
          <strong>{safeTasks.length}</strong>
        </div>

        <div className="stat">
          <span>Owned by me</span>
          <strong>{ownedCount}</strong>
        </div>

        <div className="stat">
          <span>Shared with me</span>
          <strong>{assignedCount}</strong>
        </div>

        <div className="stat">
          <span>Open work estimated</span>
          <strong>{hours(openMinutesEstimate)}</strong>
        </div>
      </div>

      <div className="card">

        <div className="tasks-header">
          <div className="tasks-header-info">
            <h2>
              <Briefcase size={16} style={{ verticalAlign: "-2px", marginRight: "6px" }} />
              Assigned to me
            </h2>
            <p className="muted">
              {safeTasks.length} task{safeTasks.length !== 1 ? "s" : ""}
            </p>
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
        </div>

        {view === "board" && (
          <TaskBoard tasks={safeTasks} onChanged={load} onEdit={setOpenTask} mode="admin" />
        )}

        {view === "calendar" && (
          <TaskCalendar tasks={safeTasks} onEdit={setOpenTask} mode="admin" />
        )}

        {view === "list" && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Task</th>
                  <th>Owner</th>
                  <th>Priority</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Comments</th>
                </tr>
              </thead>
              <tbody>
                {safeTasks.map((task) => (
                  <tr key={task.id}>
                    <td>{task.Project?.name || "-"}</td>
                    <td>
                      <div
                        className="task-title-row"
                        style={{ cursor: "pointer" }}
                        onClick={() => setOpenTask(task)}
                      >
                        <span
                          className={`priority-dot priority-${task.priority || "medium"}`}
                        />
                        <strong>{task.taskTitle}</strong>
                      </div>
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
                        {task.status === "pending" ? "Open" : task.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>
                      <button className="btn small secondary" onClick={() => setOpenTask(task)}>
                        <MessageSquare size={12} /> {task.Comments?.length || 0}
                      </button>
                    </td>
                  </tr>
                ))}

                {!safeTasks.length && (
                  <tr>
                    <td colSpan="7" className="empty">
                      Nothing assigned to you yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {openTask && (
        <TaskDetail
          task={openTask}
          currentUser={currentUser}
          onSaved={() => {
            load();
            setOpenTask(null);
          }}
          onClose={() => setOpenTask(null)}
        />
      )}

    </Layout>
  );
}
