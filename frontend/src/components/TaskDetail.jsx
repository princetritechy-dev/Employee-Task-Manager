import React from "react";
import TaskForm from "./TaskForm";
import TaskComments from "./TaskComments";

/*
|--------------------------------------------------------------------------
| TaskDetail — ClickUp-style unified task popup
|--------------------------------------------------------------------------
| One modal instead of two: the task's fields on the left (via TaskForm,
| unchanged/reused as-is) and Activity/Comments permanently visible on the
| right (via TaskComments), instead of switching between separate "Edit"
| and "Comments" modals. For a brand-new task (no id yet) there's nothing
| to comment on, so it falls back to a single centered column.
|--------------------------------------------------------------------------
*/

export default function TaskDetail({
  task,
  onClose,
  onSaved,
  defaultProjectId,
  lockProject,
  currentUser,
}) {
  const hasTask = !!task?.id;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`task-detail-modal ${!hasTask ? "single-column" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="task-detail-main">
          <TaskForm
            editingTask={task}
            defaultProjectId={defaultProjectId}
            lockProject={lockProject}
            onSaved={onSaved}
            onCancel={onClose}
          />
        </div>

        {hasTask && (
          <div className="task-detail-side">
            <h3 className="task-detail-side-title">Activity</h3>
            <TaskComments
              taskId={task.id}
              task={task}
              currentUserId={currentUser?.id}
              currentUserRole={currentUser?.role}
            />
          </div>
        )}
      </div>
    </div>
  );
}
