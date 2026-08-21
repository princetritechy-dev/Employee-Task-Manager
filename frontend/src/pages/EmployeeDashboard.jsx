import React, { useEffect, useState } from "react";
import { Lock, Unlock, Download } from "lucide-react";
import Layout from "../components/Layout";
import TaskForm from "../components/TaskForm";
import api from "../api";

function hours(minutes) {
  const m = Number(minutes || 0);
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function EmployeeDashboard() {
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState({});
  const [error, setError] = useState("");
  const [editingTask, setEditingTask] = useState(null);
  const [projectId, setProjectId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeSpent, setTimeSpent] = useState("");
  const [taskDate, setTaskDate] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);

  async function load() {
    try {
      const taskRes = await api.get("/tasks/my");

      setTasks(taskRes.data);

      setTasks(taskRes.data);

      const all = taskRes.data;

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
  }, []);

async function handleEditTask(task) {
  setEditingTask(task);

  setProjectId(task.projectId);
  setTaskTitle(task.taskTitle);
  setDescription(task.description);
  setTimeSpent(task.timeSpent);
  setTaskDate(task.taskDate);
}


  /* =========================================================
     DELETE TASK
  ========================================================= */

  async function deleteTask(id) {
    if (!confirm("Delete this task?")) return;

    try {
      await api.delete(`/tasks/${id}`);
      load();
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Task cannot be deleted"
      );
    }
  }


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
          TASK FORM
      ===================================================== */}

      <TaskForm
        onSaved={load}
        editingTask={editingTask}
        setEditingTask={setEditingTask}
      />


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
              {tasks.length} task
              {tasks.length !== 1 ? "s" : ""} recorded
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
            TASK TABLE
        ===================================================== */}

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

              {tasks.map((task) => (

                <tr key={task.id}>

                  <td>
                    {task.taskDate}
                  </td>


                  <td>
                    {task.Project?.name || "-"}
                  </td>


                  <td>

                    <strong>
                      {task.taskTitle}
                    </strong>

                    <br />

                    <small>
                      {task.description}
                    </small>


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

                  </td>


                  <td className="task-actions">

                    {task.isLocked ? (
                      <span className="locked-text">
                        Locked
                      </span>
                    ) : (
                      <button
                        className="edit-btn"
                        onClick={() => {
                          setEditingTask(task);
                          setShowEditModal(true);
                        }}
                      >
                        Edit
                      </button>
                    )}

                    <button
                      className={`delete-btn ${task.isLocked ? "disabled" : ""}`}
                      onClick={() => !task.isLocked && deleteTask(task.id)}
                      disabled={task.isLocked}
                    >
                      Delete
                    </button>

                  </td>

                </tr>

              ))}


              {!tasks.length && (

                <tr>

                  <td
                    colSpan="7"
                    className="empty"
                  >
                    No tasks yet.
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </div>

{showEditModal && (
  <div className="modal-overlay">

    <div className="edit-modal">

      <TaskForm
        editingTask={editingTask}
        onSaved={() => {
          load();
          setShowEditModal(false);
          setEditingTask(null);
        }}
        setEditingTask={setEditingTask}
        onCancel={() => {
          setShowEditModal(false);
          setEditingTask(null);
        }}
      />

    </div>

  </div>
)}

    </Layout>
  );
}