import React, { useEffect, useMemo, useState } from "react";
import { Lock, Unlock, Download, FileText, List, Kanban, CalendarRange, Plus, MessageSquare } from "lucide-react";
import Layout from "../components/Layout";
import TaskBoard from "../components/TaskBoard";
import TaskCalendar from "../components/TaskCalendar";
import TaskDetail from "../components/TaskDetail";
import ConfirmDialog from "../components/ConfirmDialog";
import api from "../api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function hours(m) {
  m = Number(m || 0);
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function AdminDashboard() {
  const currentUser = JSON.parse(sessionStorage.getItem("user") || "null");
  const isAdmin = currentUser?.role === "admin";

  const [summary, setSummary] = useState({});
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [filters, setFilters] = useState({
    employeeId: "",
    projectId: "",
    date: "",
  });

  const [employeeSummary, setEmployeeSummary] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [view, setView] = useState("list");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [search, setSearch] = useState("");

  const [pendingConfirm, setPendingConfirm] = useState(null);

  async function loadBase() {
    try {
      const [s, e, p] = await Promise.all([
        api.get("/admin/dashboard"),
        api.get("/admin/employees"),
        api.get("/projects"),
      ]);

      setSummary(s.data);
      setEmployees(e.data);
      setProjects(p.data);
    } catch (error) {
      console.error("Could not load dashboard data", error);
    }
  }

  async function loadTasks() {
    try {
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([k, v]) => {
        if (v) {
          params.set(k, v);
        }
      });

      const r = await api.get(
        `/tasks/admin/all?${params.toString()}`
      );

      setTasks(Array.isArray(r.data) ? r.data : []);
    } catch (error) {
      console.error("Could not load tasks", error);
      setTasks([]);
    }
  }

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    loadTasks();

    // Keep this dashboard live — pick up task changes made by employees
    // (or another admin tab) without needing a manual reload. Rebuilding
    // this on [filters] (not just once) keeps polling honoring whatever
    // filters are currently selected, instead of a stale initial set.
    const interval = setInterval(loadTasks, 6000);
    return () => clearInterval(interval);
  }, [filters]);

  /* =========================================================
     UNLOCK TASK (admin override)
  ========================================================= */

  async function unlockTask(taskId) {
    try {
      await api.patch(
        `/tasks/admin/${taskId}/unlock`
      );

      await loadTasks();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          "Could not unlock task"
      );
    }
  }

  async function lockTask(taskId) {
    try {
      await api.patch(
        `/tasks/admin/${taskId}/lock`
      );

      await loadTasks();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          "Could not lock task"
      );
    }
  }

  async function deleteTask(taskId) {
    try {
      await api.delete(`/tasks/${taskId}`);
      await loadTasks();
    } catch (error) {
      alert(
        error.response?.data?.message ||
          "Could not delete task"
      );
    }
  }

  async function selectEmployee(id) {
    setFilters({
      ...filters,
      employeeId: id,
    });

    if (id) {
      try {
        const r = await api.get(
          `/tasks/admin/employee/${id}/summary`
        );

        setEmployeeSummary(r.data);
      } catch (error) {
        console.error(
          "Could not load employee summary",
          error
        );
      }
    } else {
      setEmployeeSummary(null);
    }
  }

  /* =========================================================
     CSV EXPORT
  ========================================================= */

  function exportCSV() {
    if (!tasks.length) {
      alert("There are no tasks to export.");
      return;
    }

    const headers = [
      "Date",
      "Employee",
      "Email",
      "Project",
      "Task",
      "Description",
      "Assigned By",
      "Time",
      "Time Minutes",
      "Status",
      "Locked Until",
    ];

    const rows = tasks.map((task) => [
      task.taskDate || "",
      task.Employee?.name || "Unknown",
      task.Employee?.email || "",
      task.Project?.name || "",
      task.taskTitle || "",
      task.description || "",
      task.assignedBy || "",
      hours(task.timeSpent),
      Number(task.timeSpent || 0),
      task.isLocked ? "Locked" : "Editable",
      task.lockedUntil
        ? new Date(task.lockedUntil).toLocaleString()
        : "",
    ]);

    const escapeCSV = (value) => {
      const stringValue = String(value ?? "");

      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    };

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

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    const datePart =
      filters.date || "all-dates";

    link.download = `task-manager-${datePart}.csv`;

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /* =========================================================
     PDF EXPORT
  ========================================================= */

  function exportPDF() {
    if (!tasks.length) {
      alert("There are no tasks to export.");
      return;
    }

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    doc.setFontSize(18);
    doc.text("Task Manager - Employee Tasks", 14, 15);

    doc.setFontSize(10);

    let filterText = "Filters: ";

    const selectedEmployee =
      employees.find(
        (employee) =>
          String(employee.id) ===
          String(filters.employeeId)
      );

    const selectedProject =
      projects.find(
        (project) =>
          String(project.id) ===
          String(filters.projectId)
      );

    const filterParts = [];

    if (selectedEmployee) {
      filterParts.push(
        `Employee: ${selectedEmployee.name}`
      );
    }

    if (selectedProject) {
      filterParts.push(
        `Project: ${selectedProject.name}`
      );
    }

    if (filters.date) {
      filterParts.push(
        `Date: ${filters.date}`
      );
    }

    if (!filterParts.length) {
      filterText += "All";
    } else {
      filterText += filterParts.join(" | ");
    }

    doc.text(filterText, 14, 22);

    doc.text(
      `Generated: ${new Date().toLocaleString()}`,
      14,
      28
    );

    const tableRows = tasks.map((task) => [
      task.taskDate || "",
      task.Employee?.name || "Unknown",
      task.Project?.name || "",
      task.taskTitle || "",
      task.assignedBy || "",
      hours(task.timeSpent),
      task.isLocked ? "Locked" : "Editable",
    ]);

    autoTable(doc, {
      startY: 34,

      head: [
        [
          "Date",
          "Employee",
          "Project",
          "Task",
          "Assigned By",
          "Time",
          "Status",
        ],
      ],

      body: tableRows,

      styles: {
        fontSize: 8,
        cellPadding: 3,
      },

      headStyles: {
        fontStyle: "bold",
      },

      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 30 },
        2: { cellWidth: 30 },
        3: { cellWidth: 65 },
        4: { cellWidth: 30 },
        5: { cellWidth: 22 },
        6: { cellWidth: 22 },
      },

      didDrawPage: function () {
        const pageCount =
          doc.internal.getNumberOfPages();

        const currentPage =
          doc.internal.getCurrentPageInfo()
            .pageNumber;

        doc.setFontSize(8);

        doc.text(
          `Page ${currentPage} of ${pageCount}`,
          270,
          200,
          {
            align: "right",
          }
        );
      },
    });

    const datePart =
      filters.date || "all-dates";

    doc.save(
      `task-manager-${datePart}.pdf`
    );
  }

  /* =========================================================
     COMMENTS
  ========================================================= */

  const allTags = useMemo(() => {
    const set = new Set();
    tasks.forEach((t) => (t.tags || []).forEach((tag) => set.add(tag)));
    return [...set];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (priorityFilter && (t.priority || "medium") !== priorityFilter) return false;
      if (tagFilter && !(t.tags || []).includes(tagFilter)) return false;
      if (
        search &&
        !`${t.taskTitle} ${t.description || ""} ${t.Employee?.name || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [tasks, priorityFilter, tagFilter, search]);

  function openComments(task) {
    setEditingTask(task);
    setShowEditModal(true);
  }

  return (
    <Layout title="Admin Dashboard">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="page-head">

        <div>
          <h1>Admin Dashboard</h1>

          <p className="muted">
            All employees, projects and time.
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
          MAIN STATS
      ===================================================== */}

      <div className="stats">

        <div className="stat">
          <span>Employees</span>
          <strong>
            {summary.employees || 0}
          </strong>
        </div>

        <div className="stat">
          <span>Ongoing projects</span>
          <strong>
            {summary.ongoingProjects || 0}
          </strong>
        </div>

        <div className="stat">
          <span>Total tasks</span>
          <strong>
            {summary.totalTasks || 0}
          </strong>
        </div>

      </div>


      {/* =====================================================
          EMPLOYEE SUMMARY
      ===================================================== */}

      {employeeSummary && (
        <div className="stats">

          <div className="stat">
            <span>
              Selected employee today
            </span>

            <strong>
              {hours(
                employeeSummary.todayMinutes
              )}
            </strong>
          </div>

          <div className="stat">
            <span>
              Selected employee 7 days
            </span>

            <strong>
              {hours(
                employeeSummary.weekMinutes
              )}
            </strong>
          </div>

          <div className="stat">
            <span>
              Selected employee month
            </span>

            <strong>
              {hours(
                employeeSummary.monthMinutes
              )}
            </strong>
          </div>

        </div>
      )}


      {/* =====================================================
          FILTERS
      ===================================================== */}

      <div className="card">

        <h2>Task Filters</h2>

        <div className="filters">

          <select
            value={filters.employeeId}
            onChange={(e) =>
              selectEmployee(e.target.value)
            }
          >
            <option value="">
              All employees
            </option>

            {employees.map((employee) => (
              <option
                key={employee.id}
                value={employee.id}
              >
                {employee.name}
              </option>
            ))}
          </select>


          <select
            value={filters.projectId}
            onChange={(e) =>
              setFilters({
                ...filters,
                projectId: e.target.value,
              })
            }
          >
            <option value="">
              All projects
            </option>

            {projects.map((project) => (
              <option
                key={project.id}
                value={project.id}
              >
                {project.name}
              </option>
            ))}
          </select>


          <input
            type="date"
            value={filters.date}
            onChange={(e) =>
              setFilters({
                ...filters,
                date: e.target.value,
              })
            }
          />


          <button
            className="btn secondary"
            onClick={() => {
              setFilters({
                employeeId: "",
                projectId: "",
                date: "",
              });

              setEmployeeSummary(null);
            }}
          >
            Clear
          </button>

        </div>

      </div>


      {/* =====================================================
          TASK TABLE
      ===================================================== */}

      <div className="card">

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "18px",
          }}
        >

          <div>
            <h2 style={{ marginBottom: "4px" }}>
              All Employee Tasks
            </h2>

            <p className="muted">
              {filteredTasks.length} of {tasks.length} task
              {tasks.length !== 1 ? "s" : ""}
              {" "}shown
            </p>
          </div>


          {/* EXPORT BUTTONS */}

          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >

            <button
              className="btn secondary"
              onClick={exportCSV}
              disabled={!tasks.length}
              title="Export tasks as CSV"
            >
              <Download size={16} />
              Export CSV
            </button>


            <button
              className="btn"
              onClick={exportPDF}
              disabled={!tasks.length}
              title="Export tasks as PDF"
            >
              <FileText size={16} />
              Export PDF
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
              placeholder="Search tasks or employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>

            {allTags.length > 0 && (
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
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

        {view === "board" && (
          <TaskBoard
            tasks={filteredTasks}
            onChanged={loadTasks}
            onEdit={openComments}
            mode="admin"
          />
        )}

        {view === "calendar" && (
          <TaskCalendar
            tasks={filteredTasks}
            onEdit={openComments}
            mode="admin"
          />
        )}

        {view === "list" && (
        <div className="table-wrap">

          <table>

            <thead>

              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Project</th>
                <th>Task</th>
                <th>Assigned By</th>
                <th>Time</th>
                <th>Lock</th>
                <th>Comment</th>
              </tr>

            </thead>


            <tbody>

              {filteredTasks.map((task) => (

                <tr key={task.id}>

                  <td>
                    {task.taskDate}
                  </td>


                  <td>

                    <div className="employee-cell">

                      <div className="employee-avatar">
                        {task.Employee?.name
                          ?.charAt(0)
                          ?.toUpperCase() || "U"}
                      </div>

                      <div>

                        <strong>
                          {task.Employee?.name ||
                            "Unknown"}
                        </strong>

                        <small>
                          {task.Employee?.email || ""}
                        </small>

                      </div>

                    </div>

                  </td>


                  <td>
                    {task.Project?.name}
                  </td>


                  <td>

                    <div
                      className="task-title-row"
                      style={{ cursor: "pointer" }}
                      onClick={() => openComments(task)}
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

                  </td>


                  <td>
                    {task.assignedBy || "-"}
                  </td>


                  <td>
                    {hours(task.timeSpent)}
                  </td>


                  <td>

                    <div className="lock-cell">

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

                      {task.isLocked ? (
                        <button
                          className="btn small secondary"
                          onClick={() =>
                            setPendingConfirm({
                              type: "unlock",
                              taskId: task.id,
                              title: "Unlock this task?",
                              message: "Unlock this task before the 1-hour window ends?",
                              danger: false,
                              confirmLabel: "Unlock",
                            })
                          }
                          title="Unlock this task early"
                        >
                          Unlock
                        </button>
                      ) : (
                        <button
                          className="btn small secondary"
                          onClick={() =>
                            setPendingConfirm({
                              type: "lock",
                              taskId: task.id,
                              title: "Lock this task?",
                              message: "This will lock the task immediately.",
                              danger: false,
                              confirmLabel: "Lock",
                            })
                          }
                          title="Lock this task now"
                        >
                          Lock
                        </button>
                      )}

                    </div>

                  </td>


                  <td>

                    <div className="task-actions-cell">

                      {isAdmin && !task.isLocked && (
                        <button
                          className="btn small secondary"
                          onClick={() => {
                            setEditingTask(task);
                            setShowEditModal(true);
                          }}
                        >
                          Edit
                        </button>
                      )}

                      <button
                        className="btn small"
                        onClick={() =>
                          openComments(task)
                        }
                      >
                        <MessageSquare size={12} />
                      Comments
                  </button>

                      {isAdmin && (
                        <button
                          className="btn small danger"
                          onClick={() =>
                            setPendingConfirm({
                              type: "delete-task",
                              taskId: task.id,
                              title: "Delete this task?",
                              message: "This cannot be undone.",
                              confirmLabel: "Delete",
                            })
                          }
                        >
                          Delete
                        </button>
                      )}

                    </div>

                  </td>

                </tr>

              ))}


              {!filteredTasks.length && (
                <tr>

                  <td
                    colSpan="8"
                    className="empty"
                  >
                    No matching tasks.
                  </td>

                </tr>
              )}

            </tbody>

          </table>

        </div>
        )}

      </div>

      <ConfirmDialog
        open={!!pendingConfirm}
        title={pendingConfirm?.title}
        message={pendingConfirm?.message}
        confirmLabel={pendingConfirm?.confirmLabel}
        danger={pendingConfirm?.danger !== false}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          const { type, taskId } = pendingConfirm;
          setPendingConfirm(null);
          if (type === "unlock") unlockTask(taskId);
          if (type === "lock") lockTask(taskId);
          if (type === "delete-task") deleteTask(taskId);
        }}
      />



      {/* =====================================================
          COMMENTS MODAL
      ===================================================== */}

      {showEditModal && (
        <TaskDetail
          task={editingTask}
          currentUser={currentUser}
          onSaved={() => {
            loadTasks();
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