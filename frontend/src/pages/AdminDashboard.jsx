import React, { useEffect, useMemo, useState } from "react";
import { Lock, Unlock, Download, FileText, List, Kanban, CalendarRange, Plus } from "lucide-react";
import Layout from "../components/Layout";
import TaskBoard from "../components/TaskBoard";
import TaskCalendar from "../components/TaskCalendar";
import TaskDetail from "../components/TaskDetail";
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
  const [allUsers, setAllUsers] = useState([]);

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

  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "employee" });
  const [createUserError, setCreateUserError] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState(null);
  const [editUserError, setEditUserError] = useState("");
  const [savingUser, setSavingUser] = useState(false);

  function startEditUser(person) {
    setEditingUser(person);
    setEditUserError("");
    setEditUserForm({
      name: person.name,
      email: person.email,
      role: person.role,
      status: person.status,
    });
  }

  async function saveEditUser(e) {
    e.preventDefault();
    setEditUserError("");
    setSavingUser(true);

    try {
      await api.put(`/admin/users/${editingUser.id}`, editUserForm);
      setEditingUser(null);
      setEditUserForm(null);
      await loadUsers();
    } catch (error) {
      setEditUserError(error.response?.data?.message || "Could not update user");
    } finally {
      setSavingUser(false);
    }
  }

  async function deleteUser(person) {
    if (!window.confirm(`Delete ${person.name}? This can't be undone.`)) {
      return;
    }

    try {
      await api.delete(`/admin/users/${person.id}`);
      await loadUsers();
    } catch (error) {
      alert(error.response?.data?.message || "Could not delete user");
    }
  }

  async function loadUsers() {
    if (!isAdmin) return;
    try {
      const r = await api.get("/admin/users");
      setAllUsers(Array.isArray(r.data) ? r.data : []);
    } catch (error) {
      console.error("Could not load users", error);
    }
  }

  async function createUser(e) {
    e.preventDefault();
    setCreateUserError("");
    setCreatingUser(true);

    try {
      await api.post("/admin/users", newUser);
      setNewUser({ name: "", email: "", password: "", role: "employee" });
      setShowCreateUserModal(false);
      await Promise.all([loadUsers(), loadBase()]);
    } catch (error) {
      setCreateUserError(
        error.response?.data?.message || "Could not create user"
      );
    } finally {
      setCreatingUser(false);
    }
  }

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
    loadUsers();
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
    if (
      !window.confirm(
        "Unlock this task before the 1-hour window ends?"
      )
    ) {
      return;
    }

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
    if (!window.confirm("Lock this task now?")) {
      return;
    }

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
    if (!window.confirm("Delete this task? This cannot be undone.")) {
      return;
    }

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

                              <span>
                                Until{" "}
                                {new Date(
                                  task.lockedUntil
                                ).toLocaleTimeString(
                                  [],
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </span>
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
                            unlockTask(task.id)
                          }
                          title="Unlock this task early"
                        >
                          Unlock
                        </button>
                      ) : (
                        <button
                          className="btn small secondary"
                          onClick={() =>
                            lockTask(task.id)
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

                      {!task.isLocked && (
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
                        💬 Comment
                      </button>

                      <button
                        className="btn small danger"
                        onClick={() => deleteTask(task.id)}
                      >
                        Delete
                      </button>

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


      {/* =====================================================
          USERS
      ===================================================== */}

      <div className="card">

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}
        >
          <h2 style={{ margin: 0 }}>
            {isAdmin ? "Users" : "Employees"}
          </h2>

          {isAdmin && (
            <button
              className="btn small"
              onClick={() => setShowCreateUserModal(true)}
            >
              <Plus size={14} /> Add User
            </button>
          )}
        </div>

        <div className="table-wrap">

          <table>

            <thead>

              <tr>
                <th>Name</th>
                <th>Email</th>
                {isAdmin && <th>Role</th>}
                <th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>

            </thead>

            <tbody>

              {(isAdmin ? allUsers : employees).map((person) => (

                <tr key={person.id}>

                  <td>
                    {person.name}
                  </td>

                  <td>
                    {person.email}
                  </td>

                  {isAdmin && (
                    <td style={{ textTransform: "capitalize" }}>
                      {person.role}
                    </td>
                  )}

                  <td>

                    <span
                      className={`status-badge ${
                        person.status === "active"
                          ? "status-active"
                          : "status-inactive"
                      }`}
                    >

                      <span className="status-dot" />

                      {person.status}

                    </span>

                  </td>

                  {isAdmin && (
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          className="btn small secondary"
                          onClick={() => startEditUser(person)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn small danger"
                          onClick={() => deleteUser(person)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}

                </tr>

              ))}

              {isAdmin && !allUsers.length && (
                <tr>
                  <td colSpan="5" className="empty">
                    No employees or supervisors yet — add one above.
                  </td>
                </tr>
              )}

            </tbody>

          </table>

        </div>

      </div>

      {showCreateUserModal && (
        <div className="modal-overlay" onClick={() => setShowCreateUserModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Add User</h2>
                <p className="muted">Create an employee or supervisor account</p>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowCreateUserModal(false)}
              >
                ×
              </button>
            </div>

            {createUserError && <div className="error">{createUserError}</div>}

            <form onSubmit={createUser}>
              <label>Name</label>
              <input
                required
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                placeholder="Full name"
              />

              <label>Email</label>
              <input
                required
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="name@example.com"
              />

              <label>Password</label>
              <input
                required
                type="password"
                minLength={6}
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="At least 6 characters, letter + number"
              />

              <label>Role</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              >
                <option value="employee">Employee</option>
                <option value="supervisor">Supervisor</option>
              </select>

              <div className="form-actions" style={{ marginTop: "14px" }}>
                <button className="btn" disabled={creatingUser}>
                  {creatingUser ? "Creating..." : "Create User"}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setShowCreateUserModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && editUserForm && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Edit User</h2>
                <p className="muted">{editingUser.email}</p>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setEditingUser(null)}
              >
                ×
              </button>
            </div>

            {editUserError && <div className="error">{editUserError}</div>}

            <form onSubmit={saveEditUser}>
              <label>Name</label>
              <input
                required
                value={editUserForm.name}
                onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
              />

              <label>Email</label>
              <input
                required
                type="email"
                value={editUserForm.email}
                onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
              />

              <label>Role</label>
              <select
                value={editUserForm.role}
                onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
              >
                <option value="employee">Employee</option>
                <option value="supervisor">Supervisor</option>
              </select>

              <label>Status</label>
              <select
                value={editUserForm.status}
                onChange={(e) => setEditUserForm({ ...editUserForm, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <div className="form-actions" style={{ marginTop: "14px" }}>
                <button className="btn" disabled={savingUser}>
                  {savingUser ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


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