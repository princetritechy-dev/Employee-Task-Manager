import React, { useEffect, useState } from "react";
import { Lock, Unlock, Download, FileText } from "lucide-react";
import Layout from "../components/Layout";
import api from "../api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function hours(m) {
  m = Number(m || 0);
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function AdminDashboard() {
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
  const [commentTask, setCommentTask] = useState(null);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);

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

      setTasks(r.data);
    } catch (error) {
      console.error("Could not load tasks", error);
    }
  }

  useEffect(() => {
    loadBase();
    loadTasks();
  }, []);

  useEffect(() => {
    loadTasks();
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

  async function openComments(task) {
    setCommentTask(task);

    try {
      const response = await api.get(
        `/comments/task/${task.id}`
      );

      setComments(response.data);
    } catch (error) {
      alert(
        error.response?.data?.message ||
          "Could not load comments"
      );
    }
  }

  async function addComment() {
    if (!comment.trim()) return;

    try {
      await api.post(
        `/comments/task/${commentTask.id}`,
        {
          comment,
        }
      );

      setComment("");

      await openComments(commentTask);
    } catch (error) {
      alert(
        error.response?.data?.message ||
          "Could not add comment"
      );
    }
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
              {tasks.length} task
              {tasks.length !== 1 ? "s" : ""}
              {" "}found
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

              {tasks.map((task) => (

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

                    <strong>
                      {task.taskTitle}
                    </strong>

                    <br />

                    <small>
                      {task.description}
                    </small>

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

                          <button
                            className="btn small secondary"
                            style={{ marginLeft: "8px" }}
                            onClick={() =>
                              unlockTask(task.id)
                            }
                            title="Unlock this task early"
                          >
                            Unlock
                          </button>
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


                  <td>

                    <button
                      className="btn small"
                      onClick={() =>
                        openComments(task)
                      }
                    >
                      💬 Comment
                    </button>

                  </td>

                </tr>

              ))}


              {!tasks.length && (
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

      </div>


      {/* =====================================================
          EMPLOYEES
      ===================================================== */}

      <div className="card">

        <h2>Employees</h2>

        <div className="table-wrap">

          <table>

            <thead>

              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
              </tr>

            </thead>

            <tbody>

              {employees.map((employee) => (

                <tr key={employee.id}>

                  <td>
                    {employee.name}
                  </td>

                  <td>
                    {employee.email}
                  </td>

                  <td>

                    <span
                      className={`status-badge ${
                        employee.status === "active"
                          ? "status-active"
                          : "status-inactive"
                      }`}
                    >

                      <span className="status-dot" />

                      {employee.status}

                    </span>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>


      {/* =====================================================
          COMMENTS MODAL
      ===================================================== */}

      {commentTask && (

        <div className="modal-overlay">

          <div className="modal">

            <div className="modal-header">

              <div>

                <h2>
                  Task Comments
                </h2>

                <p>
                  <strong>
                    {commentTask.taskTitle}
                  </strong>
                </p>

                <small>
                  Employee:{" "}
                  {commentTask.Employee?.name}
                </small>

              </div>


              <button
                className="close-btn"
                onClick={() => {
                  setCommentTask(null);
                  setComments([]);
                  setComment("");
                }}
              >
                ×
              </button>

            </div>


            <div className="comments">

              {comments.length === 0 ? (

                <p className="muted">
                  No comments yet.
                </p>

              ) : (

                comments.map((item) => (

                  <div
                    className="comment"
                    key={item.id}
                  >

                    <div className="comment-top">

                      <strong>
                        {item.Admin?.name ||
                          "Admin"}
                      </strong>

                      <small>
                        {new Date(
                          item.createdAt
                        ).toLocaleString()}
                      </small>

                    </div>


                    <p>
                      {item.comment}
                    </p>


                    <button
                      className="btn danger small"
                      onClick={async () => {

                        if (
                          !window.confirm(
                            "Delete this comment?"
                          )
                        ) {
                          return;
                        }

                        try {

                          await api.delete(
                            `/comments/${item.id}`
                          );

                          await openComments(
                            commentTask
                          );

                        } catch (error) {

                          alert(
                            error.response
                              ?.data?.message ||
                              "Could not delete comment"
                          );

                        }

                      }}
                    >
                      Delete
                    </button>

                  </div>

                ))

              )}

            </div>


            <textarea
              rows="4"
              placeholder="Write an admin comment..."
              value={comment}
              onChange={(e) =>
                setComment(e.target.value)
              }
            />


            <button
              className="btn"
              onClick={addComment}
              disabled={!comment.trim()}
            >
              Add Comment
            </button>

          </div>

        </div>

      )}

    </Layout>
  );
}