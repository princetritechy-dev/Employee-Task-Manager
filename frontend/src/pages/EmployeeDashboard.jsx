import React, { useEffect, useMemo, useState } from "react";
import { Lock, Unlock, Download, List, Kanban, CalendarRange, MessageSquare, Plus } from "lucide-react";
import Layout from "../components/Layout";
import TaskBoard from "../components/TaskBoard";
import TaskCalendar from "../components/TaskCalendar";
import TaskDetail from "../components/TaskDetail";
import api from "../api";

function hours(minutes) {
  const m = Number(minutes || 0);
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function EmployeeDashboard() {
  const currentUser = JSON.parse(sessionStorage.getItem("user") || "null");
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({});
  const [error, setError] = useState("");
  const [editingTask, setEditingTask] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [view, setView] = useState("list");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    try {
      const taskRes = await api.get("/tasks/my");

      const safeData = Array.isArray(taskRes.data) ? taskRes.data : [];

      setTasks(safeData);

      const all = safeData;

      const today = new Date()
        .toISOString()
        .slice(0, 10);

      const start = new Date();

      start.setDate(start.getDate() - 6);

      const week = start
        .toISOString()
        .slice(0, 10);

      const month =
        today.slice(0, 7) + "-01";

      const sum = (list) =>
        list.reduce(
          (a, t) =>
            a + Number(t.timeSpent || 0),
          0
        );

      setSummary({
        today: sum(
          all.filter(
            (t) => t.taskDate === today
          )
        ),

        week: sum(
          all.filter(
            (t) =>
              t.taskDate >= week &&
              t.taskDate <= today
          )
        ),

        month: sum(
          all.filter(
            (t) =>
              t.taskDate >= month &&
              t.taskDate <= today
          )
        ),
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not load tasks"
      );
    }
  }

  useEffect(() => {
    load();

    // Keep this dashboard live — pick up changes made elsewhere
    // (by an admin, or from another tab) without needing a manual reload.
    const interval = setInterval(load, 6000);
    return () => clearInterval(interval);
  }, []);



  /* =========================================================
     EXPORT CSV
  ========================================================= */

  function exportCSV() {
    if (!tasks.length) {
      alert("There are no tasks to export.");
      return;
    }

    let totalMinutes = 0;

    const headers = [
      "S. No.",
      "Date",
      "Project Name",
      "Description",
      "Assigned By",
      "Work Hours",
    ];

    const rows = tasks.map((task, index) => {
      const workMinutes = Number(
        task.timeSpent || 0
      );

      totalMinutes += workMinutes;

      return [
        index + 1,
        task.taskDate || "",
        task.Project?.name || "",
        task.description || task.taskTitle || "",
        task.assignedBy || "",
        hours(workMinutes),
      ];
    });

    /* Add total at the bottom */
    rows.push([
      "",
      "",
      "",
      "TOTAL WORKING HOURS",
      "",
      hours(totalMinutes),
    ]);

    function escapeCSV(value) {
      const stringValue = String(
        value ?? ""
      );

      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replace(
          /"/g,
          '""'
        )}"`;
      }

      return stringValue;
    }

    const csv = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) =>
        row.map(escapeCSV).join(",")
      ),
    ].join("\n");

    const blob = new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      `my-tasks-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }


  const allTags = useMemo(() => {
    const set = new Set();
    tasks.forEach((t) => (t.tags || []).forEach((tag) => set.add(tag)));
    return [...set];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterPriority && (t.priority || "medium") !== filterPriority) return false;
      if (filterTag && !(t.tags || []).includes(filterTag)) return false;
      if (
        search &&
        !`${t.taskTitle} ${t.description || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [tasks, filterPriority, filterTag, search]);

  function openEdit(task) {
    setEditingTask(task);
    setShowEditModal(true);
  }

  return (
    <Layout title="Employee Dashboard">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="page-head">

        <div>
          <h1>My Dashboard</h1>

          <p className="muted">
            Track your daily work and time.
          </p>
        </div>

        <button
          className="btn"
          onClick={() => {
            setEditingTask(null);
            setShowEditModal(true);
          }}
        >
          <Plus size={16} /> New Task
        </button>

      </div>


      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="error">
          {error}
        </div>
      )}


      {/* =====================================================
          STATS
      ===================================================== */}

      <div className="stats">

        <div className="stat">
          <span>Today</span>

          <strong>
            {hours(summary.today)}
          </strong>
        </div>

        <div className="stat">
          <span>Last 7 days</span>

          <strong>
            {hours(summary.week)}
          </strong>
        </div>

        <div className="stat">
          <span>This month</span>

          <strong>
            {hours(summary.month)}
          </strong>
        </div>

      </div>


      {/* =====================================================
          TASKS
      ===================================================== */}

{/* =====================================================
    TASKS
===================================================== */}

      <div className="card">

        <div className="tasks-header">

          {/* LEFT */}
          <div className="tasks-header-info">

            <h2>My Tasks</h2>

            <p className="muted">
              {filteredTasks.length} of {tasks.length} task
              {tasks.length !== 1 ? "s" : ""} shown
            </p>

          </div>


          {/* RIGHT */}
          <div className="tasks-header-actions">

            {/* TOTAL */}
            <div className="export-summary">

              <span className="export-summary-label">
                Total working
              </span>

              <strong>
                {hours(
                  tasks.reduce(
                    (total, task) =>
                      total + Number(task.timeSpent || 0),
                    0
                  )
                )}
              </strong>

            </div>


            {/* CSV */}
            <button
              className="export-csv-btn"
              onClick={exportCSV}
              disabled={!tasks.length}
            >
              <Download size={17} />

              <span>
                Export CSV
              </span>
            </button>

          </div>

        </div>

        {/* =====================================================
            VIEW SWITCHER + FILTERS
        ===================================================== */}

        <div className="view-toolbar">

          <div className="view-switcher">
            <button
              className={view === "list" ? "active" : ""}
              onClick={() => setView("list")}
            >
              <List size={14} /> List
            </button>
            <button
              className={view === "board" ? "active" : ""}
              onClick={() => setView("board")}
            >
              <Kanban size={14} /> Board
            </button>
            <button
              className={view === "calendar" ? "active" : ""}
              onClick={() => setView("calendar")}
            >
              <CalendarRange size={14} /> Calendar
            </button>
          </div>

          <div className="view-filters">
            <input
              className="filter-search"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>

            {allTags.length > 0 && (
              <select
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
              >
                <option value="">All tags</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            )}
          </div>

        </div>

        {/* =====================================================
            BOARD VIEW
        ===================================================== */}

        {view === "board" && (
          <TaskBoard
            tasks={filteredTasks}
            onChanged={load}
            onEdit={openEdit}
          />
        )}

        {/* =====================================================
            CALENDAR VIEW
        ===================================================== */}

        {view === "calendar" && (
          <TaskCalendar tasks={filteredTasks} onEdit={openEdit} />
        )}

        {/* =====================================================
            TASK TABLE (LIST VIEW)
        ===================================================== */}

        {view === "list" && (
        <div className="table-wrap">

          <table>

            <thead>

              <tr>
                <th>Date</th>
                <th>Project</th>
                <th>Task</th>
                <th>Assigned By</th>
                <th>Time</th>
                <th>Lock</th>
                <th>Action</th>
              </tr>

            </thead>


            <tbody>

              {filteredTasks.map((task) => (

                <tr key={task.id}>

                  <td>
                    {task.taskDate}
                  </td>


                  <td>
                    {task.Project?.name || "-"}
                  </td>


                  <td>

                    <div
                      className="task-title-row"
                      style={{ cursor: "pointer" }}
                      onClick={() => openEdit(task)}
                    >
                      <span className={`priority-dot priority-${task.priority || "medium"}`} title={`${task.priority || "medium"} priority`} />
                      <strong>
                        {task.taskTitle}
                      </strong>
                    </div>

                    <br />

                    <small>
                      {task.description}
                    </small>

                    {(task.dueDate || task.tags?.length > 0 || task.subtasks?.length > 0) && (
                      <div className="task-meta-row">
                        {task.dueDate && (
                          <span className="meta-chip">Due {task.dueDate}</span>
                        )}
                        {task.subtasks?.length > 0 && (
                          <span className="meta-chip">
                            {task.subtasks.filter((s) => s.completed).length}/
                            {task.subtasks.length} subtasks
                          </span>
                        )}
                        {task.tags?.map((tag) => (
                          <span className="tag-chip small" key={tag}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}


                    {/* ADMIN COMMENTS */}
                    {task.Comments?.length > 0 && (
                      <div className="task-comments">

                        <strong>
                          Admin Comments:
                        </strong>


                        {task.Comments.map((comment)=>(
                          <div 
                            key={comment.id}
                            className="comment-box"
                          >

                            <p>
                              {comment.comment}
                            </p>

                            <small>
                              By: {comment.Admin?.name || "Admin"}
                            </small>

                          </div>
                        ))}

                      </div>
                    )}

                  </td>


                  <td>
                    {task.assignedBy || "-"}
                  </td>


                  <td>
                    {hours(task.timeSpent)}
                  </td>

                  <td>

                    <div
                      className={`lock-status ${
                        task.isLocked
                          ? "locked"
                          : "unlocked"
                      }`}
                    >

                      {task.isLocked ? (
                        <>
                          <Lock size={14} />

                          <div>

                            <strong>
                              Locked
                            </strong>

                          </div>
                        </>
                      ) : (
                        <>
                          <Unlock size={14} />

                          <div>

                            <strong>
                              Editable
                            </strong>

                            <span>
                              Available
                            </span>

                          </div>
                        </>
                      )}

                    </div>

                  </td>


                  <td className="task-actions">

                    <button
                      className="edit-btn"
                      onClick={() => openEdit(task)}
                    >
                      View
                    </button>

                    <button
                      className="btn small secondary"
                      onClick={() => openEdit(task)}
                    >
                      <MessageSquare size={12} /> Comments
                    </button>

                  </td>

                </tr>

              ))}


              {!filteredTasks.length && (

                <tr>

                  <td
                    colSpan="7"
                    className="empty"
                  >
                    {tasks.length ? "No tasks match your filters." : "No tasks yet."}
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>
        )}

      </div>

{showEditModal && (
  <TaskDetail
    task={editingTask}
    currentUser={currentUser}
    onSaved={() => {
      load();
      setShowEditModal(false);
      setEditingTask(null);
    }}
    onClose={() => {
      setShowEditModal(false);
      setEditingTask(null);
    }}
  />
)}

    </Layout>
  );
}