const User = require("./User");
const Project = require("./Project");
const Task = require("./Task");
const TaskComment = require("./TaskComment");

/*
|--------------------------------------------------------------------------
| Relationships
|--------------------------------------------------------------------------
| Mongoose doesn't need Sequelize-style association setup. Relationships
| are expressed directly on each schema via `ref` (see the model files) and
| resolved per-query in the controllers. Raw *Id fields stay on the JSON
| output (so the frontend can still read e.g. task.projectId directly),
| with the resolved documents attached under the old Sequelize association
| aliases:
|
|   - Project.members    -> [User]    (was the ProjectMember join table, alias "Users")
|   - Task.userId         -> User      (alias "Employee")
|   - Task.projectId      -> Project   (alias "Project")
|   - TaskComment.taskId  -> Task
|   - TaskComment.adminId -> User      (alias "Admin")
|--------------------------------------------------------------------------
*/

module.exports = {
  User,
  Project,
  Task,
  TaskComment,
};
