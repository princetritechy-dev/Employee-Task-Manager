const mongoose = require("mongoose");
const { Task, Project, User, TaskComment } = require("../models");


/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Serialize comment
|--------------------------------------------------------------------------
| Attaches the admin who wrote the comment under "Admin" (matching the old
| Sequelize `as: "Admin"` include) while keeping the raw adminId/taskId
| fields on the object.
|--------------------------------------------------------------------------
*/

function serializeComment(comment, admin) {
  const json = comment.toJSON();
  json.Admin = admin ? admin.toJSON() : null;
  return json;
}

/*
|--------------------------------------------------------------------------
| Serialize task
|--------------------------------------------------------------------------
| Attaches the resolved project/employee/comments under "Project" /
| "Employee" / "Comments" (matching the old Sequelize include aliases)
| while keeping the raw userId/projectId fields, and adds calculated
| properties before sending the task to the frontend.
|--------------------------------------------------------------------------
*/

function serializeTask(task, { project, employee, comments = [], adminsById = new Map(), assignees = [], blockers = [] } = {}) {
  const json = task.toJSON();

  json.Project = project ? project.toJSON() : null;
  json.Employee = employee ? employee.toJSON() : null;

  json.Comments = comments.map((c) =>
    serializeComment(c, adminsById.get(c.adminId.toString()))
  );

  json.Assignees = assignees.map((u) => u.toJSON());

  json.Blockers = blockers.map((t) => ({
    id: t.id,
    taskTitle: t.taskTitle,
    status: t.status,
  }));

  /*
  |--------------------------------------------------------------------------
  | Check 1-hour lock
  |--------------------------------------------------------------------------
  | Editable for the FIRST hour, locked AFTER that.
  |--------------------------------------------------------------------------
  */

  const lockedUntil = json.lockedUntil
    ? new Date(json.lockedUntil)
    : null;

  json.isLocked =
    lockedUntil &&
    !Number.isNaN(lockedUntil.getTime()) &&
    new Date() > lockedUntil;

  /*
  |--------------------------------------------------------------------------
  | Check running state
  |--------------------------------------------------------------------------
  */

  json.isRunning =
    json.status === "in_progress";

  return json;
}

/*
|--------------------------------------------------------------------------
| Load a single task with all its relations (Project, Employee, Comments)
|--------------------------------------------------------------------------
*/

async function loadTaskWithRelations(taskId) {
  const task = await Task.findById(taskId);
  if (!task) return null;

  const [project, employee, comments, assignees, blockers] = await Promise.all([
    Project.findById(task.projectId).select("name status"),
    User.findById(task.userId).select("name email"),
    TaskComment.find({ taskId: task._id }).sort({ createdAt: 1 }),
    User.find({ _id: { $in: task.assigneeIds || [] } }).select("name email"),
    Task.find({ _id: { $in: task.blockedBy || [] } }).select("taskTitle status"),
  ]);

  const adminIds = [...new Set(comments.map((c) => c.adminId.toString()))];
  const admins = await User.find({ _id: { $in: adminIds } }).select("name email");
  const adminsById = new Map(admins.map((a) => [a.id, a]));

  return serializeTask(task, { project, employee, comments, adminsById, assignees, blockers });
}

/*
|--------------------------------------------------------------------------
| Load many tasks with all their relations, batching the Project/User/
| Comments lookups so we don't run one query per task.
|--------------------------------------------------------------------------
*/

async function loadTasksWithRelations(tasks) {
  const taskIds = tasks.map((task) => task._id);
  const projectIds = [...new Set(tasks.map((t) => t.projectId.toString()))];
  const userIds = [...new Set(tasks.map((t) => t.userId.toString()))];

  const assigneeIds = [
    ...new Set(tasks.flatMap((t) => (t.assigneeIds || []).map(String))),
  ];

  const blockerIds = [
    ...new Set(tasks.flatMap((t) => (t.blockedBy || []).map(String))),
  ];

  const [projects, employees, comments, assigneeUsers, blockerTasks] = await Promise.all([
    Project.find({ _id: { $in: projectIds } }).select("name status"),
    User.find({ _id: { $in: userIds } }).select("name email"),
    TaskComment.find({ taskId: { $in: taskIds } }).sort({ createdAt: 1 }),
    User.find({ _id: { $in: assigneeIds } }).select("name email"),
    Task.find({ _id: { $in: blockerIds } }).select("taskTitle status"),
  ]);

  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const employeesById = new Map(employees.map((u) => [u.id, u]));
  const assigneeUsersById = new Map(assigneeUsers.map((u) => [u.id, u]));
  const blockerTasksById = new Map(blockerTasks.map((t) => [t.id, t]));

  const adminIds = [...new Set(comments.map((c) => c.adminId.toString()))];
  const admins = await User.find({ _id: { $in: adminIds } }).select("name email");
  const adminsById = new Map(admins.map((a) => [a.id, a]));

  const commentsByTask = new Map();
  for (const comment of comments) {
    const key = comment.taskId.toString();
    if (!commentsByTask.has(key)) commentsByTask.set(key, []);
    commentsByTask.get(key).push(comment);
  }

  return tasks.map((task) =>
    serializeTask(task, {
      project: projectsById.get(task.projectId.toString()),
      employee: employeesById.get(task.userId.toString()),
      comments: commentsByTask.get(task._id.toString()) || [],
      adminsById,
      assignees: (task.assigneeIds || [])
        .map((id) => assigneeUsersById.get(String(id)))
        .filter(Boolean),
      blockers: (task.blockedBy || [])
        .map((id) => blockerTasksById.get(String(id)))
        .filter(Boolean),
    })
  );
}

/*
|--------------------------------------------------------------------------
| Validate Mongo ObjectId
|--------------------------------------------------------------------------
*/

function isValidId(value) {
  return !!value && mongoose.isValidObjectId(value);
}

const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];

/*
|--------------------------------------------------------------------------
| Normalize tags
|--------------------------------------------------------------------------
| Accepts an array or a comma-separated string, trims/dedupes/lowercases.
|--------------------------------------------------------------------------
*/

function normalizeTags(tags) {
  if (tags === undefined) return undefined;

  const list = Array.isArray(tags)
    ? tags
    : String(tags || "")
        .split(",");

  const cleaned = list
    .map((t) => String(t).trim())
    .filter(Boolean);

  return [...new Set(cleaned)];
}

/*
|--------------------------------------------------------------------------
| Normalize subtasks
|--------------------------------------------------------------------------
*/

function normalizeSubtasks(subtasks) {
  if (subtasks === undefined) return undefined;

  if (!Array.isArray(subtasks)) return [];

  return subtasks
    .map((s) => ({
      title: String(s?.title || "").trim(),
      completed: !!s?.completed,
    }))
    .filter((s) => s.title);
}

/*
|--------------------------------------------------------------------------
| Normalize ObjectId list (assigneeIds / blockedBy)
|--------------------------------------------------------------------------
*/

function normalizeIdList(ids) {
  if (ids === undefined) return undefined;

  const list = Array.isArray(ids) ? ids : [ids];

  return [...new Set(list.filter((id) => isValidId(id)).map(String))];
}

const VALID_REPEATS = ["none", "daily", "weekly", "monthly"];

/*
|--------------------------------------------------------------------------
| Default status columns
|--------------------------------------------------------------------------
| Used for every project that hasn't defined its own custom columns yet
| (statusColumns is undefined until an admin customizes them), and for
| every cross-project board (My Dashboard, My Work, Admin's all-tasks
| view) which always uses this fixed set regardless of any one project's
| custom columns — a task from any project can land on those boards.
|--------------------------------------------------------------------------
*/

const DEFAULT_STATUS_COLUMNS = [
  { key: "pending", label: "Open", color: "#64748B", category: "open", promptOnEnter: false },
  { key: "in_progress", label: "In Progress", color: "#2563EB", category: "active", promptOnEnter: false },
  { key: "in_review", label: "In Review", color: "#F59E0B", category: "open", promptOnEnter: false },
  { key: "redo", label: "Redo", color: "#DC2626", category: "open", promptOnEnter: true },
  { key: "completed", label: "Completed", color: "#16A34A", category: "done", promptOnEnter: false },
];

function statusLabel(status) {
  const fallback = DEFAULT_STATUS_COLUMNS.find((c) => c.key === status);
  return fallback ? fallback.label : status.replace(/_/g, " ");
}

function getProjectColumns(project) {
  return project?.statusColumns?.length
    ? project.statusColumns
    : DEFAULT_STATUS_COLUMNS;
}

function resolveColumn(project, key) {
  const columns = getProjectColumns(project);
  return (
    columns.find((c) => c.key === key) ||
    DEFAULT_STATUS_COLUMNS.find((c) => c.key === key) || {
      key,
      label: statusLabel(key),
      category: "open",
      promptOnEnter: false,
    }
  );
}

/*
|--------------------------------------------------------------------------
| Activity log helper
|--------------------------------------------------------------------------
*/

function logActivity(task, action, message, user) {
  task.activity = task.activity || [];
  task.activity.push({
    action,
    message,
    byId: user?._id,
    byName: user?.name || "",
    at: new Date(),
  });
}

/*
|--------------------------------------------------------------------------
| Shift a "YYYY-MM-DD" date string forward for recurring tasks
|--------------------------------------------------------------------------
*/

function shiftDate(dateStr, repeat) {
  if (!dateStr) return dateStr;

  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;

  if (repeat === "daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (repeat === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (repeat === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else return dateStr;

  return d.toISOString().slice(0, 10);
}

/*
|--------------------------------------------------------------------------
| Create the next occurrence of a recurring task
|--------------------------------------------------------------------------
*/

async function spawnNextOccurrence(task) {
  if (!task.repeat || task.repeat === "none") return null;

  const nextTaskDate = shiftDate(task.taskDate, task.repeat);
  const nextDueDate = task.dueDate ? shiftDate(task.dueDate, task.repeat) : null;

  const now = new Date();
  const lockedUntil = new Date(now.getTime() + 60 * 60 * 1000);

  return Task.create({
    userId: task.userId,
    projectId: task.projectId,
    taskTitle: task.taskTitle,
    description: task.description,
    assignedBy: task.assignedBy,
    timeSpent: 0,
    status: "pending",
    startedAt: null,
    completedAt: null,
    taskDate: nextTaskDate,
    lockedUntil,
    priority: task.priority,
    dueDate: nextDueDate,
    tags: task.tags,
    subtasks: (task.subtasks || []).map((s) => ({ title: s.title, completed: false })),
    assigneeIds: task.assigneeIds,
    estimateMinutes: task.estimateMinutes,
    blockedBy: [],
    repeat: task.repeat,
    order: 0,
    activity: [
      {
        action: "created",
        message: `Auto-created as the next ${task.repeat} occurrence`,
        at: new Date(),
      },
    ],
  });
}


/*
|--------------------------------------------------------------------------
| DATE RANGES
|--------------------------------------------------------------------------
*/

function getDateRanges() {
  const now = new Date();

  const today = now.toISOString().slice(0, 10);

  const weekStart = new Date(now);

  weekStart.setDate(
    weekStart.getDate() - 6
  );

  const weekStartStr =
    weekStart.toISOString().slice(0, 10);

  const monthStart =
    `${today.slice(0, 7)}-01`;

  return {
    today,
    weekStartStr,
    monthStart,
  };
}


/*
|--------------------------------------------------------------------------
| TOTAL MINUTES
|--------------------------------------------------------------------------
*/

function totalMinutes(tasks) {
  return tasks.reduce(
    (total, task) =>
      total + Number(task.timeSpent || 0),
    0
  );
}


/*
|--------------------------------------------------------------------------
| CREATE TASK
|--------------------------------------------------------------------------
| Any authenticated active user can create a task.
|
| userId normally comes from req.user._id. The one exception: an admin
| can create a task "for" another project member by passing forUserId —
| that employee becomes the task's owner, so it shows up on their own
| dashboard immediately, same as if they'd created it themselves.
|--------------------------------------------------------------------------
*/

exports.create = async (req, res) => {
  try {
    const {
      projectId,
      taskTitle,
      description,
      taskDate,
      timeSpent,
      assignedBy,
      priority,
      dueDate,
      tags,
      subtasks,
      assigneeIds,
      estimateMinutes,
      blockedBy,
      repeat,
      forUserId,
    } = req.body;

    /*
    |--------------------------------------------------------------------------
    | Validate required fields
    |--------------------------------------------------------------------------
    */

    if (
      !projectId ||
      !taskTitle ||
      !taskDate
    ) {
      return res.status(400).json({
        message:
          "Project, title, and date are required",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Validate priority
    |--------------------------------------------------------------------------
    */

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        message: "Invalid priority",
      });
    }

    if (repeat && !VALID_REPEATS.includes(repeat)) {
      return res.status(400).json({
        message: "Invalid repeat interval",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Validate project ID
    |--------------------------------------------------------------------------
    */

    if (!isValidId(projectId)) {
      return res.status(400).json({
        message: "Invalid project",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Validate title
    |--------------------------------------------------------------------------
    */

    const title =
      String(taskTitle).trim();

    if (!title) {
      return res.status(400).json({
        message:
          "Task title cannot be empty",
      });
    }

    if (title.length > 255) {
      return res.status(400).json({
        message:
          "Task title cannot exceed 255 characters",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Validate project
    |--------------------------------------------------------------------------
    */

    const project =
      await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Prevent adding tasks to completed projects
    |--------------------------------------------------------------------------
    */

    if (project.status === "completed") {
      return res.status(400).json({
        message:
          "Tasks cannot be added to a completed project",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Resolve the task's owner
    |--------------------------------------------------------------------------
    | Defaults to the creator. An admin can instead create it "for" any
    | employee — like ClickUp, assigning someone outside the project auto-
    | shares the project with them rather than blocking the assignment.
    |--------------------------------------------------------------------------
    */

    let ownerId = req.user._id;
    let projectMembersChanged = false;

    function ensureProjectMember(userId) {
      const already = (project.members || []).some(
        (m) => String(m) === String(userId)
      );
      if (!already) {
        project.members.push(userId);
        projectMembersChanged = true;
      }
    }

    if (forUserId && req.user.role === "admin") {
      if (!isValidId(forUserId)) {
        return res.status(400).json({ message: "Invalid employee" });
      }

      const employee = await User.findById(forUserId).select("_id");

      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      ownerId = forUserId;
      ensureProjectMember(forUserId);
    }

    const normalizedAssigneeIds = normalizeIdList(assigneeIds) || [];

    if (req.user.role === "admin") {
      normalizedAssigneeIds.forEach(ensureProjectMember);
    }

    if (projectMembersChanged) {
      await project.save();
    }

    /*
    |--------------------------------------------------------------------------
    | Create first-hour lock
    |--------------------------------------------------------------------------
    | lockedUntil marks when the 1-hour EDIT WINDOW ENDS.
    | Before this timestamp -> editable. After -> locked.
    |--------------------------------------------------------------------------
    */

    const now = new Date();

    const lockedUntil =
      new Date(
        now.getTime() +
          60 * 60 * 1000
      );

      const minutes = Number(timeSpent || 0);

      if (
        !Number.isInteger(minutes) ||
        minutes < 0 ||
        minutes > 1440
      ) {
        return res.status(400).json({
          message:
            "Time must be between 0 and 1440 minutes",
        });
      }
    /*
    |--------------------------------------------------------------------------
    | Board order — place new card at the end of the "pending" column
    |--------------------------------------------------------------------------
    */

    const lastInColumn = await Task.findOne({
      userId: ownerId,
      status: "pending",
    }).sort({ order: -1 });

    const nextOrder = lastInColumn
      ? lastInColumn.order + 1
      : 0;

    /*
    |--------------------------------------------------------------------------
    | CREATE TASK
    |--------------------------------------------------------------------------
    */

    const task = await Task.create({
      userId: ownerId,

      projectId,

      taskTitle: title,

      description:
        description
          ? String(description).trim()
          : "",

      assignedBy:
        assignedBy
          ? String(assignedBy).trim()
          : "",

      /*
      |----------------------------------------------------------------------
      | Timer starts at 0
      |----------------------------------------------------------------------
      */

      timeSpent: minutes,

      /*
      |----------------------------------------------------------------------
      | Initial status
      |----------------------------------------------------------------------
      */

      status: "pending",

      startedAt: null,

      completedAt: null,

      taskDate,

      lockedUntil,

      priority: priority || "medium",

      dueDate: dueDate || null,

      tags: normalizeTags(tags) || [],

      subtasks: normalizeSubtasks(subtasks) || [],

      order: nextOrder,

      assigneeIds: normalizedAssigneeIds,

      estimateMinutes: Number(estimateMinutes) > 0 ? Number(estimateMinutes) : 0,

      blockedBy: normalizeIdList(blockedBy) || [],

      repeat: VALID_REPEATS.includes(repeat) ? repeat : "none",

      activity: [
        {
          action: "created",
          message:
            String(ownerId) !== String(req.user._id)
              ? `${req.user.name || "Admin"} created and assigned this task`
              : `${req.user.name || "Someone"} created this task`,
          byId: req.user._id,
          byName: req.user.name || "",
          at: new Date(),
        },
      ],
    });

    /*
    |--------------------------------------------------------------------------
    | Return complete task
    |--------------------------------------------------------------------------
    */

    const result = await loadTaskWithRelations(task._id);

    return res
      .status(201)
      .json(result);
  } catch (error) {
    console.error(
      "Create task error:",
      error
    );

    return res.status(500).json({
      message:
        "Could not create task",
    });
  }
};


/*
|--------------------------------------------------------------------------
| MY TASKS
|--------------------------------------------------------------------------
| Employees can ONLY see their own tasks.
|--------------------------------------------------------------------------
*/

exports.myTasks = async (
  req,
  res
) => {

  try {

    const where = {
      userId: req.user._id,
    };


    /*
    |--------------------------------------------------------------------------
    | Optional date filter
    |--------------------------------------------------------------------------
    */

    if (req.query.date) {

      where.taskDate =
        req.query.date;

    }


    /*
    |--------------------------------------------------------------------------
    | Get employee tasks
    |--------------------------------------------------------------------------
    */

    const tasks =
      await Task.find(where)
        .sort({ taskDate: -1, createdAt: -1 });


    return res.json(
      await loadTasksWithRelations(tasks)
    );



  } catch(error) {


    console.error(
      "My tasks error:",
      error
    );


    return res.status(500).json({

      message:
        "Could not load tasks",

    });


  }

};


/*
|--------------------------------------------------------------------------
| START TASK
|--------------------------------------------------------------------------
| Employee starts timer.
|--------------------------------------------------------------------------
*/

exports.startTask = async (
  req,
  res
) => {

  try {

    const taskId =
      req.params.id;



    /*
    |--------------------------------------------------------------------------
    | Validate task ID
    |--------------------------------------------------------------------------
    */

    if (!isValidId(taskId)) {

      return res.status(400).json({
        message:
          "Invalid task ID",
      });

    }




    /*
    |--------------------------------------------------------------------------
    | Find employee task
    |--------------------------------------------------------------------------
    */

    const task =
      await Task.findOne({

        _id: taskId,

        userId:
          req.user._id,

      });



    if (!task) {

      return res.status(404).json({
        message:
          "Task not found",
      });

    }





    /*
    |--------------------------------------------------------------------------
    | Completed task cannot start
    |--------------------------------------------------------------------------
    */

    if (
      task.status === "completed"
    ) {

      return res.status(400).json({
        message:
          "Completed task cannot be started",
      });

    }




    /*
    |--------------------------------------------------------------------------
    | Prevent duplicate timer
    |--------------------------------------------------------------------------
    */

    if (
      task.status === "in_progress"
    ) {

      return res.status(400).json({
        message:
          "Task is already running",
      });

    }





    /*
    |--------------------------------------------------------------------------
    | Start timer
    |--------------------------------------------------------------------------
    */

    task.status = "in_progress";
    task.startedAt = new Date();

    logActivity(task, "started", `${req.user.name || "Someone"} started this task`, req.user);

    await task.save();


    /*
    |--------------------------------------------------------------------------
    | Return updated task
    |--------------------------------------------------------------------------
    */

    const result = await loadTaskWithRelations(task._id);

    return res.json({

      message:
        "Task started successfully",


      task: result,

    });




  } catch(error) {


    console.error(
      "Start task error:",
      error
    );



    return res.status(500).json({

      message:
        "Could not start task",

    });


  }

};


/*
|--------------------------------------------------------------------------
| COMPLETE TASK
|--------------------------------------------------------------------------
| Stops timer and automatically calculates time.
|--------------------------------------------------------------------------
*/

exports.completeTask = async (
  req,
  res
) => {

  try {

    const taskId = req.params.id;



    /*
    |--------------------------------------------------------------------------
    | Validate ID
    |--------------------------------------------------------------------------
    */

    if (!isValidId(taskId)) {

      return res.status(400).json({
        message:
          "Invalid task ID",
      });

    }




    /*
    |--------------------------------------------------------------------------
    | Find employee task
    |--------------------------------------------------------------------------
    */

    const task =
      await Task.findOne({

        _id: taskId,

        userId:
          req.user._id,

      });



    if (!task) {

      return res.status(404).json({
        message:
          "Task not found",
      });

    }




    /*
    |--------------------------------------------------------------------------
    | Task must be running
    |--------------------------------------------------------------------------
    */

    if (
      task.status !== "in_progress"
    ) {

      return res.status(400).json({
        message:
          "Task is not currently running",
      });

    }




    /*
    |--------------------------------------------------------------------------
    | Validate started time
    |--------------------------------------------------------------------------
    */

    if (!task.startedAt) {

      return res.status(400).json({
        message:
          "Task start time not found",
      });

    }





    /*
    |--------------------------------------------------------------------------
    | Calculate elapsed time
    |--------------------------------------------------------------------------
    */

    const now =
      new Date();


    const started =
      new Date(
        task.startedAt
      );


    const elapsedMinutes =
      Math.max(

        1,

        Math.floor(

          (
            now.getTime() -
            started.getTime()

          ) / 60000

        )

      );





    /*
    |--------------------------------------------------------------------------
    | Add timer minutes
    |--------------------------------------------------------------------------
    */

    const totalTime =
      Number(
        task.timeSpent || 0
      )
      +
      elapsedMinutes;





    /*
    |--------------------------------------------------------------------------
    | Complete task
    |--------------------------------------------------------------------------
    */

    task.status = "completed";
    task.completedAt = now;
    task.timeSpent = totalTime;

    logActivity(task, "completed", `${req.user.name || "Someone"} completed this task`, req.user);

    await task.save();






    /*
    |--------------------------------------------------------------------------
    | Soft dependency check
    |--------------------------------------------------------------------------
    */

    const openBlockers = await Task.find({
      _id: { $in: task.blockedBy || [] },
      status: { $ne: "completed" },
    }).select("taskTitle");

    /*
    |--------------------------------------------------------------------------
    | Spawn next occurrence if this task recurs
    |--------------------------------------------------------------------------
    */

    await spawnNextOccurrence(task);

    /*
    |--------------------------------------------------------------------------
    | Return updated task
    |--------------------------------------------------------------------------
    */

    const result = await loadTaskWithRelations(task._id);

    return res.json({

      message:
        "Task completed successfully",


      task: result,

      blockersStillOpen: openBlockers.map((t) => t.taskTitle),

    });





  } catch(error) {


    console.error(
      "Complete task error:",
      error
    );



    return res.status(500).json({

      message:
        "Could not complete task",

    });


  }

};


/*
|--------------------------------------------------------------------------
| UPDATE TASK
|--------------------------------------------------------------------------
| Employee can update ONLY their own task.
| Task must be unlocked (within the first hour of creation, or
| re-opened by an admin via unlockTask).
|--------------------------------------------------------------------------
*/

exports.update = async (
  req,
  res
) => {
  try {

    const taskId = req.params.id;


    /*
    |--------------------------------------------------------------------------
    | Validate ID
    |--------------------------------------------------------------------------
    */

    if (!isValidId(taskId)) {
      return res.status(400).json({
        message: "Invalid task ID",
      });
    }



    /*
    |--------------------------------------------------------------------------
    | Find task
    |--------------------------------------------------------------------------
    | Only admins can edit task content now — this route is admin-only
    | (see routes/tasks.js), so no ownership branching is needed here.
    |--------------------------------------------------------------------------
    */

    const task = await Task.findById(taskId);



    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }



    /*
    |--------------------------------------------------------------------------
    | Lock check
    |--------------------------------------------------------------------------
    | Editable for the first hour, locked AFTER that.
    |--------------------------------------------------------------------------
    */

    if (
      task.lockedUntil &&
      new Date() > new Date(task.lockedUntil)
    ) {

      return res.status(423).json({
        message:
          `Task was locked at ${
            new Date(
              task.lockedUntil
            ).toLocaleString()
          }`,
      });

    }




    /*
    |--------------------------------------------------------------------------
    | Request data
    |--------------------------------------------------------------------------
    */

    const {
      projectId,
      taskTitle,
      description,
      taskDate,
      timeSpent,
      assignedBy,
      priority,
      dueDate,
      tags,
      subtasks,
      assigneeIds,
      estimateMinutes,
      blockedBy,
      repeat,
    } = req.body;



    /*
    |--------------------------------------------------------------------------
    | Validate priority
    |--------------------------------------------------------------------------
    */

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        message: "Invalid priority",
      });
    }

    if (repeat && !VALID_REPEATS.includes(repeat)) {
      return res.status(400).json({
        message: "Invalid repeat interval",
      });
    }



    /*
    |--------------------------------------------------------------------------
    | Validate project
    |--------------------------------------------------------------------------
    */

    if (!isValidId(projectId)) {

      return res.status(400).json({
        message: "Invalid project",
      });

    }



    const project =
      await Project.findById(projectId);



    if (!project) {

      return res.status(404).json({
        message:
          "Project not found",
      });

    }



    if (
      project.status === "completed"
    ) {

      return res.status(400).json({
        message:
          "Tasks cannot be assigned to a completed project",
      });

    }




    /*
    |--------------------------------------------------------------------------
    | Validate title
    |--------------------------------------------------------------------------
    */

    const title =
      String(
        taskTitle || ""
      ).trim();



    if (!title) {

      return res.status(400).json({
        message:
          "Task title is required",
      });

    }



    if (title.length > 255) {

      return res.status(400).json({
        message:
          "Task title cannot exceed 255 characters",
      });

    }




    /*
    |--------------------------------------------------------------------------
    | Validate date
    |--------------------------------------------------------------------------
    */

    if (!taskDate) {

      return res.status(400).json({
        message:
          "Task date is required",
      });

    }




    /*
    |--------------------------------------------------------------------------
    | Validate time
    |--------------------------------------------------------------------------
    */

    let minutes =
      task.timeSpent;



    if (
      timeSpent !== undefined
    ) {

      minutes =
        Number(timeSpent);



      if (
        !Number.isInteger(minutes) ||
        minutes < 0 ||
        minutes > 1440
      ) {

        return res.status(400).json({
          message:
            "Time must be between 0 and 1440 minutes",
        });

      }

    }





    /*
    |--------------------------------------------------------------------------
    | Update task
    |--------------------------------------------------------------------------
    */

    task.projectId = projectId;

    task.taskTitle = title;

    task.description =
      description
        ? String(description).trim()
        : "";

    task.assignedBy =
      assignedBy !== undefined
        ? String(assignedBy).trim()
        : task.assignedBy;

    task.taskDate = taskDate;

    task.timeSpent = minutes;

    if (priority) task.priority = priority;

    if (dueDate !== undefined) task.dueDate = dueDate || null;

    const nextTags = normalizeTags(tags);
    if (nextTags !== undefined) task.tags = nextTags;

    const nextSubtasks = normalizeSubtasks(subtasks);
    if (nextSubtasks !== undefined) task.subtasks = nextSubtasks;

    const nextAssignees = normalizeIdList(assigneeIds);
    if (nextAssignees !== undefined) {
      task.assigneeIds = nextAssignees;

      const project = await Project.findById(task.projectId);
      if (project) {
        const before = (project.members || []).length;
        nextAssignees.forEach((userId) => {
          const already = (project.members || []).some(
            (m) => String(m) === String(userId)
          );
          if (!already) project.members.push(userId);
        });
        if (project.members.length !== before) await project.save();
      }
    }

    const nextBlockedBy = normalizeIdList(blockedBy);
    if (nextBlockedBy !== undefined) task.blockedBy = nextBlockedBy;

    if (estimateMinutes !== undefined) {
      const est = Number(estimateMinutes);
      task.estimateMinutes = Number.isFinite(est) && est > 0 ? est : 0;
    }

    if (repeat && VALID_REPEATS.includes(repeat)) task.repeat = repeat;

    logActivity(task, "updated", `${req.user.name || "Someone"} updated this task`, req.user);

    await task.save();





    /*
    |--------------------------------------------------------------------------
    | Return updated task
    |--------------------------------------------------------------------------
    */

    const result = await loadTaskWithRelations(task._id);



    return res.json(
      result
    );



  } catch(error) {


    console.error(
      "Update task error:",
      error
    );


    return res.status(500).json({

      message:
        "Could not update task",

    });

  }
};


/*
|--------------------------------------------------------------------------
| DELETE TASK
|--------------------------------------------------------------------------
| Employee can ONLY delete their own unlocked task.
|--------------------------------------------------------------------------
*/

exports.remove = async (
  req,
  res
) => {
  try {
    const taskId = req.params.id;

    /*
    |--------------------------------------------------------------------------
    | Validate ID
    |--------------------------------------------------------------------------
    */

    if (!isValidId(taskId)) {
      return res.status(400).json({
        message: "Invalid task ID",
      });
    }


    /*
    |--------------------------------------------------------------------------
    | Find task
    |--------------------------------------------------------------------------
    | Only admins can delete tasks — this route is admin-only, so no
    | ownership restriction: any task can be looked up by ID.
    |--------------------------------------------------------------------------
    */

    const task = await Task.findById(taskId);


    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }


    /*
    |--------------------------------------------------------------------------
    | First hour lock check
    |--------------------------------------------------------------------------
    | Editable for the first hour, locked AFTER that.
    |--------------------------------------------------------------------------
    */

    if (
      task.lockedUntil &&
      new Date() > new Date(task.lockedUntil)
    ) {
      return res.status(423).json({
        message:
          "Task is locked — the 1-hour edit window has passed",
      });
    }


    /*
    |--------------------------------------------------------------------------
    | Running task cannot delete
    |--------------------------------------------------------------------------
    */

    if (
      task.status === "in_progress"
    ) {
      return res.status(400).json({
        message:
          "Stop the task before deleting it",
      });
    }


    /*
    |--------------------------------------------------------------------------
    | Delete task comments first
    |--------------------------------------------------------------------------
    */

    await TaskComment.deleteMany({
      taskId: task._id,
    });


    /*
    |--------------------------------------------------------------------------
    | Delete task
    |--------------------------------------------------------------------------
    */

    await task.deleteOne();


    return res.json({
      message:
        "Task deleted successfully",
    });


  } catch (error) {

    console.error(
      "Delete task error:",
      error
    );


    return res.status(500).json({
      message:
        "Could not delete task",
    });
  }
};

/*
|--------------------------------------------------------------------------
| ADMIN — ALL TASKS
|--------------------------------------------------------------------------
| Protected by adminOnly middleware
|--------------------------------------------------------------------------
*/

exports.adminTasks = async (
  req,
  res
) => {

  try {

    const where = {};



    /*
    |--------------------------------------------------------------------------
    | Employee filter
    |--------------------------------------------------------------------------
    */

    if (req.query.employeeId) {


      if (
        !isValidId(
          req.query.employeeId
        )
      ) {

        return res.status(400).json({

          message:
            "Invalid employee ID",

        });

      }


      where.userId =
        req.query.employeeId;

    }




    /*
    |--------------------------------------------------------------------------
    | Project filter
    |--------------------------------------------------------------------------
    */

    if (req.query.projectId) {


      if (
        !isValidId(
          req.query.projectId
        )
      ) {

        return res.status(400).json({

          message:
            "Invalid project ID",

        });

      }


      where.projectId =
        req.query.projectId;

    }




    /*
    |--------------------------------------------------------------------------
    | Date filter
    |--------------------------------------------------------------------------
    */

    if (req.query.date) {

      where.taskDate =
        req.query.date;

    }




    /*
    |--------------------------------------------------------------------------
    | Status filter
    |--------------------------------------------------------------------------
    */

    if (req.query.status) {


      const validStatuses = [

        "pending",

        "in_progress",

        "completed",

      ];



      if (
        !validStatuses.includes(
          req.query.status
        )
      ) {

        return res.status(400).json({

          message:
            "Invalid task status",

        });

      }


      where.status =
        req.query.status;

    }




    /*
    |--------------------------------------------------------------------------
    | Fetch tasks
    |--------------------------------------------------------------------------
    */

    const tasks =
      await Task.find(where)
        .sort({ taskDate: -1, createdAt: -1 });



    return res.json(

      await loadTasksWithRelations(tasks)

    );




  } catch(error) {


    console.error(

      "Admin tasks error:",

      error

    );



    return res.status(500).json({

      message:

        "Could not load tasks",

    });


  }

};


/*
|--------------------------------------------------------------------------
| ADMIN — SUMMARY
|--------------------------------------------------------------------------
*/

exports.summary = async (
  req,
  res
) => {
  try {

    const tasks = await Task.find({}).select(
      "userId projectId timeSpent taskDate status"
    );


    const {
      today,
      weekStartStr,
      monthStart,
    } = getDateRanges();


    /*
    |--------------------------------------------------------------------------
    | Convert task date safely
    |--------------------------------------------------------------------------
    */

    const formatTaskDate = (task) => {

      if (!task.taskDate) {
        return null;
      }


      // taskDate is always stored as a "YYYY-MM-DD" string
      if (
        typeof task.taskDate === "string"
      ) {
        return task.taskDate;
      }


      return new Date(
        task.taskDate
      )
        .toISOString()
        .slice(0, 10);

    };



    /*
    |--------------------------------------------------------------------------
    | Today's tasks
    |--------------------------------------------------------------------------
    */

    const todayTasks =
      tasks.filter(
        (task) => {

          return (
            formatTaskDate(task) === today
          );

        }
      );



    /*
    |--------------------------------------------------------------------------
    | This week's tasks
    |--------------------------------------------------------------------------
    */

    const weekTasks =
      tasks.filter(
        (task) => {

          const taskDate =
            formatTaskDate(task);


          return (
            taskDate >= weekStartStr &&
            taskDate <= today
          );

        }
      );



    /*
    |--------------------------------------------------------------------------
    | This month's tasks
    |--------------------------------------------------------------------------
    */

    const monthTasks =
      tasks.filter(
        (task) => {

          const taskDate =
            formatTaskDate(task);


          return (
            taskDate >= monthStart &&
            taskDate <= today
          );

        }
      );



    /*
    |--------------------------------------------------------------------------
    | Status counts
    |--------------------------------------------------------------------------
    */

    const completedToday =
      todayTasks.filter(
        (task) =>
          task.status === "completed"
      ).length;



    const pendingToday =
      todayTasks.filter(
        (task) =>
          task.status === "pending"
      ).length;



    const inProgressToday =
      todayTasks.filter(
        (task) =>
          task.status === "in_progress"
      ).length;



    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    return res.json({

      totalTasks:
        tasks.length,


      todayTasks:
        todayTasks.length,


      todayMinutes:
        totalMinutes(
          todayTasks
        ),


      weekMinutes:
        totalMinutes(
          weekTasks
        ),


      monthMinutes:
        totalMinutes(
          monthTasks
        ),


      completedToday,


      pendingToday,


      inProgressToday,

    });



  } catch (error) {

    console.error(
      "Admin summary error:",
      error
    );


    return res.status(500).json({

      message:
        "Could not load summary",

    });

  }
};


/*
|--------------------------------------------------------------------------
| ADMIN — EMPLOYEE SUMMARY
|--------------------------------------------------------------------------
*/

exports.employeeSummary = async (
  req,
  res
) => {

  try {

    const employeeId =
      req.params.id;


    /*
    |--------------------------------------------------------------------------
    | Validate employee ID
    |--------------------------------------------------------------------------
    */

    if (!isValidId(employeeId)) {

      return res.status(400).json({
        message:
          "Invalid employee ID",
      });

    }



    /*
    |--------------------------------------------------------------------------
    | Verify employee exists
    |--------------------------------------------------------------------------
    */

    const employee =
      await User.findById(employeeId).select(
        "name email role status"
      );


    if (!employee) {

      return res.status(404).json({
        message:
          "Employee not found",
      });

    }

    /*
    |--------------------------------------------------------------------------
    | Get employee tasks
    |--------------------------------------------------------------------------
    */

    const tasks =
      await Task.find({
        userId: employeeId,
      }).select(
        "timeSpent taskDate status"
      );



    const {
      today,
      weekStartStr,
      monthStart,
    } = getDateRanges();




    /*
    |--------------------------------------------------------------------------
    | Convert task date safely
    |--------------------------------------------------------------------------
    */

    const formatTaskDate = (task) => {


      if (!task.taskDate) {

        return null;

      }



      // taskDate is always stored as a "YYYY-MM-DD" string
      if (
        typeof task.taskDate === "string"
      ) {

        return task.taskDate;

      }



      return new Date(
        task.taskDate
      )
        .toISOString()
        .slice(0,10);

    };




    /*
    |--------------------------------------------------------------------------
    | Today's Tasks
    |--------------------------------------------------------------------------
    */

    const todayTasks =
      tasks.filter(

        (task) => {

          return (
            formatTaskDate(task)
            ===
            today
          );

        }

      );




    /*
    |--------------------------------------------------------------------------
    | Weekly Tasks
    |--------------------------------------------------------------------------
    */

    const weekTasks =
      tasks.filter(

        (task)=>{


          const taskDate =
            formatTaskDate(task);



          return (

            taskDate >= weekStartStr

            &&

            taskDate <= today

          );


        }

      );




    /*
    |--------------------------------------------------------------------------
    | Monthly Tasks
    |--------------------------------------------------------------------------
    */

    const monthTasks =
      tasks.filter(

        (task)=>{


          const taskDate =
            formatTaskDate(task);



          return (

            taskDate >= monthStart

            &&

            taskDate <= today

          );


        }

      );




    /*
    |--------------------------------------------------------------------------
    | Status counts
    |--------------------------------------------------------------------------
    */

    const completedTasks =
      tasks.filter(

        (task)=>

          task.status === "completed"

      ).length;



    const pendingTasks =
      tasks.filter(

        (task)=>

          task.status === "pending"

      ).length;



    const inProgressTasks =
      tasks.filter(

        (task)=>

          task.status === "in_progress"

      ).length;




    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    return res.json({

      employee: {

        id:
          employee.id,


        name:
          employee.name,


        email:
          employee.email,


        status:
          employee.status,

      },


      todayMinutes:

        totalMinutes(
          todayTasks
        ),



      weekMinutes:

        totalMinutes(
          weekTasks
        ),



      monthMinutes:

        totalMinutes(
          monthTasks
        ),



      totalTasks:

        tasks.length,



      completedTasks,



      pendingTasks,



      inProgressTasks,

    });



  } catch(error) {


    console.error(
      "Employee summary error:",
      error
    );


    return res.status(500).json({

      message:
        "Could not load employee summary",

    });


  }

};

/*
|--------------------------------------------------------------------------
| ADMIN — UNLOCK TASK
|--------------------------------------------------------------------------
| Admin can re-open a task's edit window after it has locked.
|
| Since a task is now "locked" once lockedUntil is in the PAST,
| unlocking means pushing lockedUntil back into the FUTURE — giving
| the employee another full hour to edit/delete the task.
|--------------------------------------------------------------------------
*/

exports.lockTask = async (req, res) => {
  try {
    const taskId = req.params.id;

    if (!isValidId(taskId)) {
      return res.status(400).json({
        message: "Invalid task ID",
      });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    if (
      task.lockedUntil &&
      new Date() > new Date(task.lockedUntil)
    ) {
      return res.status(400).json({
        message: "Task is already locked",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Lock immediately by pushing lockedUntil into the past
    |--------------------------------------------------------------------------
    */

    task.lockedUntil = new Date(Date.now() - 1000);

    logActivity(task, "locked", `${req.user.name || "Admin"} locked this task`, req.user);

    await task.save();

    const result = await loadTaskWithRelations(task._id);

    return res.json({
      message: "Task locked successfully",
      task: result,
    });
  } catch (error) {
    console.error("Lock task error:", error);

    return res.status(500).json({
      message: "Could not lock task",
    });
  }
};

exports.unlockTask = async (req, res) => {
  try {
    const taskId = req.params.id;

    /*
    |--------------------------------------------------------------------------
    | Validate ID
    |--------------------------------------------------------------------------
    */

    if (!isValidId(taskId)) {
      return res.status(400).json({
        message: "Invalid task ID",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Find task (admin can unlock ANY employee's task)
    |--------------------------------------------------------------------------
    */

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Already unlocked — nothing to do
    |--------------------------------------------------------------------------
    */

    if (
      !task.lockedUntil ||
      new Date() <= new Date(task.lockedUntil)
    ) {
      return res.status(400).json({
        message: "Task is already unlocked",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Unlock by pushing lockedUntil 1 hour into the future
    |--------------------------------------------------------------------------
    */

    task.lockedUntil = new Date(
      Date.now() + 60 * 60 * 1000
    );

    await task.save();

    /*
    |--------------------------------------------------------------------------
    | Return updated task
    |--------------------------------------------------------------------------
    */

    const result = await loadTaskWithRelations(task._id);

    return res.json({
      message: "Task unlocked successfully",
      task: result,
    });
  } catch (error) {
    console.error("Unlock task error:", error);

    return res.status(500).json({
      message: "Could not unlock task",
    });
  }
};

/*
|--------------------------------------------------------------------------
| REOPEN TASK (back to "pending")
|--------------------------------------------------------------------------
| Lets an employee drag a card back to the "pending" column on the board.
| Clears the timer fields — starting it again will begin a fresh run.
|--------------------------------------------------------------------------
*/

exports.reopenTask = async (req, res) => {
  try {
    const taskId = req.params.id;

    if (!isValidId(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const task = await Task.findOne({
      _id: taskId,
      userId: req.user._id,
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    task.status = "pending";
    task.startedAt = null;
    task.completedAt = null;

    logActivity(task, "reopened", `${req.user.name || "Someone"} moved this task back to Open`, req.user);

    await task.save();

    const result = await loadTaskWithRelations(task._id);

    return res.json({
      message: "Task reopened successfully",
      task: result,
    });
  } catch (error) {
    console.error("Reopen task error:", error);

    return res.status(500).json({
      message: "Could not reopen task",
    });
  }
};

/*
|--------------------------------------------------------------------------
| REORDER TASK (Kanban drag & drop)
|--------------------------------------------------------------------------
| Body: { order: Number } — new position within the task's current column.
| Status changes go through start / complete / reopen instead, so the
| business rules (timer, locking) stay in one place.
|--------------------------------------------------------------------------
*/

exports.reorderTask = async (req, res) => {
  try {
    const taskId = req.params.id;

    if (!isValidId(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const { order } = req.body;

    if (!Number.isFinite(Number(order))) {
      return res.status(400).json({ message: "Invalid order" });
    }

    const task = await Task.findOne({
      _id: taskId,
      userId: req.user._id,
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    task.order = Number(order);

    await task.save();

    return res.json({ message: "Task reordered" });
  } catch (error) {
    console.error("Reorder task error:", error);

    return res.status(500).json({
      message: "Could not reorder task",
    });
  }
};

/*
|--------------------------------------------------------------------------
| TOGGLE SUBTASK
|--------------------------------------------------------------------------
*/

exports.toggleSubtask = async (req, res) => {
  try {
    const { id: taskId, subtaskId } = req.params;

    if (!isValidId(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const task = await Task.findOne({
      _id: taskId,
      userId: req.user._id,
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const subtask = task.subtasks.id(subtaskId);

    if (!subtask) {
      return res.status(404).json({ message: "Subtask not found" });
    }

    subtask.completed = !subtask.completed;

    await task.save();

    const result = await loadTaskWithRelations(task._id);

    return res.json({
      message: "Subtask updated",
      task: result,
    });
  } catch (error) {
    console.error("Toggle subtask error:", error);

    return res.status(500).json({
      message: "Could not update subtask",
    });
  }
};

/*
|--------------------------------------------------------------------------
| ADMIN — MOVE TASK (Kanban drag & drop, any employee's task)
|--------------------------------------------------------------------------
| Body: { status, order }
| Bypasses ownership + the 1-hour lock (admin override), same spirit as
| unlockTask. Keeps startedAt/completedAt consistent with the timer
| fields used elsewhere.
|--------------------------------------------------------------------------
*/

exports.adminMoveTask = async (req, res) => {
  try {
    const taskId = req.params.id;

    if (!isValidId(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const { status, order, reason } = req.body;

    const validStatuses = ["pending", "in_progress", "redo", "completed"];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid task status" });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (status && status !== task.status) {
      if (status === "in_progress") {
        task.startedAt = task.startedAt || new Date();
        task.completedAt = null;
      } else if (status === "completed") {
        const started = task.startedAt
          ? new Date(task.startedAt)
          : new Date();

        const elapsedMinutes = Math.max(
          1,
          Math.floor((Date.now() - started.getTime()) / 60000)
        );

        if (!task.startedAt) {
          task.timeSpent = Number(task.timeSpent || 0) + elapsedMinutes;
        }

        task.completedAt = new Date();
      } else if (status === "pending" || status === "redo") {
        task.startedAt = null;
        task.completedAt = null;
      }

      task.status = status;

      const statusMessage =
        status === "redo" && reason
          ? `${req.user.name || "Admin"} sent this back for redo: ${reason}`
          : `${req.user.name || "Admin"} moved this task to ${statusLabel(status)}`;

      logActivity(task, status === "redo" ? "redo" : "status_changed", statusMessage, req.user);

      if (status === "redo" && reason && reason.trim()) {
        await TaskComment.create({
          taskId: task._id,
          adminId: req.user._id,
          comment: `Sent back for redo: ${reason.trim()}`,
        });
      }
    }

    if (Number.isFinite(Number(order))) {
      task.order = Number(order);
    }

    await task.save();

    if (status === "completed") {
      await spawnNextOccurrence(task);
    }

    const result = await loadTaskWithRelations(task._id);

    return res.json({
      message: "Task moved",
      task: result,
    });
  } catch (error) {
    console.error("Admin move task error:", error);

    return res.status(500).json({
      message: "Could not move task",
    });
  }
};

/*
|--------------------------------------------------------------------------
| MY WORK — cross-project tasks assigned to the current user
|--------------------------------------------------------------------------
| Includes tasks the user owns (userId) AND tasks they've been added to
| as an assignee (assigneeIds), across every project. Available to both
| admins and employees.
|--------------------------------------------------------------------------
*/

exports.myWork = async (req, res) => {
  try {
    const tasks = await Task.find({
      $or: [
        { userId: req.user._id },
        { assigneeIds: req.user._id },
      ],
    }).sort({ dueDate: 1, taskDate: -1, createdAt: -1 });

    return res.json(await loadTasksWithRelations(tasks));
  } catch (error) {
    console.error("My work error:", error);

    return res.status(500).json({
      message: "Could not load your work",
    });
  }
};

/*
|--------------------------------------------------------------------------
| PROJECT TASKS — every task inside one project (ClickUp-style project view)
|--------------------------------------------------------------------------
| Any project member can see the whole project's tasks (not just their
| own) — same as an admin. Non-members are rejected.
|--------------------------------------------------------------------------
*/

exports.projectTasks = async (req, res) => {
  try {
    const projectId = req.params.id;

    if (!isValidId(projectId)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const isMember = (project.members || []).some(
      (m) => String(m) === String(req.user._id)
    );

    const manages = req.user.role === "admin";

    if (!manages && !isMember) {
      return res.status(403).json({
        message: "You're not a member of this project",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Visibility
    |--------------------------------------------------------------------------
    | Admins see every task in the project. Everyone else only sees tasks
    | they own or are assigned to — not their teammates' tasks.
    |--------------------------------------------------------------------------
    */

    const query = manages
      ? { projectId }
      : {
          projectId,
          $or: [
            { userId: req.user._id },
            { assigneeIds: req.user._id },
          ],
        };

    const tasks = await Task.find(query).sort({
      order: 1,
      createdAt: -1,
    });

    return res.json(await loadTasksWithRelations(tasks));
  } catch (error) {
    console.error("Project tasks error:", error);

    return res.status(500).json({
      message: "Could not load project tasks",
    });
  }
};

/*
|--------------------------------------------------------------------------
| REDO — send a task back with a query/issue (custom "Redo" column)
|--------------------------------------------------------------------------
| Body: { reason } — optional. If given, it's logged in the activity feed
| AND auto-posted as a comment (from whoever triggered the move) so it's
| visible in the task's Comments tab too, not just buried in history.
|--------------------------------------------------------------------------
*/

exports.redoTask = async (req, res) => {
  try {
    const taskId = req.params.id;

    if (!isValidId(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const { reason } = req.body;

    const task = await Task.findOne({
      _id: taskId,
      userId: req.user._id,
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    task.status = "redo";
    task.startedAt = null;
    task.completedAt = null;

    const message = reason
      ? `${req.user.name || "Someone"} sent this back for redo: ${reason}`
      : `${req.user.name || "Someone"} sent this back for redo`;

    logActivity(task, "redo", message, req.user);

    await task.save();

    if (reason && reason.trim()) {
      await TaskComment.create({
        taskId: task._id,
        adminId: req.user._id,
        comment: `Sent back for redo: ${reason.trim()}`,
      });
    }

    const result = await loadTaskWithRelations(task._id);

    return res.json({
      message: "Task sent back for redo",
      task: result,
    });
  } catch (error) {
    console.error("Redo task error:", error);

    return res.status(500).json({
      message: "Could not move task to redo",
    });
  }
};

/*
|--------------------------------------------------------------------------
| MOVE TASK (unified) — ClickUp-style custom status columns
|--------------------------------------------------------------------------
| Body: { statusKey, order, reason }
| Works for both the task owner and admins (ownership is checked here,
| not via middleware, since the rule differs by role). Looks up the
| target column on the task's own project — falling back to the default
| four columns if that project hasn't customized its columns, or if the
| key doesn't match any custom column (e.g. a task dragged on a
| cross-project board using the fixed default set).
|--------------------------------------------------------------------------
*/

exports.moveTask = async (req, res) => {
  try {
    const taskId = req.params.id;

    if (!isValidId(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const { statusKey, order, reason } = req.body;

    if (!statusKey || typeof statusKey !== "string") {
      return res.status(400).json({ message: "statusKey is required" });
    }

    /*
    |--------------------------------------------------------------------------
    | Find task
    |--------------------------------------------------------------------------
    | Admins move anything. Everyone else can only move their own tasks.
    |--------------------------------------------------------------------------
    */

    let task;

    if (req.user.role === "admin") {
      task = await Task.findById(taskId);
    } else {
      task = await Task.findOne({ _id: taskId, userId: req.user._id });
    }

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const project = await Project.findById(task.projectId);

    const previousCategory = resolveColumn(project, task.status).category;
    const column = resolveColumn(project, statusKey);

    if (column.category !== previousCategory) {
      if (column.category === "active") {
        task.startedAt = task.startedAt || new Date();
        task.completedAt = null;
      } else if (column.category === "done") {
        const started = task.startedAt
          ? new Date(task.startedAt)
          : new Date();

        const elapsedMinutes = Math.max(
          1,
          Math.floor((Date.now() - started.getTime()) / 60000)
        );

        if (!task.startedAt) {
          task.timeSpent = Number(task.timeSpent || 0) + elapsedMinutes;
        }

        task.completedAt = new Date();
      } else {
        task.startedAt = null;
        task.completedAt = null;
      }
    }

    task.status = statusKey;

    if (Number.isFinite(Number(order))) {
      task.order = Number(order);
    }

    const actorName = req.user.name || "Someone";

    const message =
      column.promptOnEnter && reason
        ? `${actorName} moved this task to ${column.label}: ${reason}`
        : `${actorName} moved this task to ${column.label}`;

    logActivity(task, column.promptOnEnter ? "redo" : "status_changed", message, req.user);

    await task.save();

    if (column.promptOnEnter && reason && reason.trim()) {
      await TaskComment.create({
        taskId: task._id,
        adminId: req.user._id,
        comment: `Moved to ${column.label}: ${reason.trim()}`,
      });
    }

    if (column.category === "done") {
      await spawnNextOccurrence(task);
    }

    const result = await loadTaskWithRelations(task._id);

    return res.json({
      message: "Task moved",
      task: result,
    });
  } catch (error) {
    console.error("Move task error:", error);

    return res.status(500).json({
      message: "Could not move task",
    });
  }
};

/*
|--------------------------------------------------------------------------
| LOG TIME — manually add minutes to a task, like ClickUp's time widget
|--------------------------------------------------------------------------
| Body: { minutes } — a positive whole number. Adds to timeSpent (doesn't
| touch startedAt/completedAt/status — this is separate from the timer
| that runs when a task is "in progress"). Allowed for the task's owner,
| or an admin.
|--------------------------------------------------------------------------
*/

exports.logTime = async (req, res) => {
  try {
    const taskId = req.params.id;

    if (!isValidId(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }

    const minutes = Number(req.body.minutes);

    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) {
      return res.status(400).json({
        message: "Enter a time between 1 minute and 24 hours",
      });
    }

    let task;

    if (req.user.role === "admin") {
      task = await Task.findById(taskId);
    } else {
      task = await Task.findOne({ _id: taskId, userId: req.user._id });
    }

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    task.timeSpent = Number(task.timeSpent || 0) + Math.round(minutes);

    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    const durationLabel = [h && `${h}h`, m && `${m}m`].filter(Boolean).join(" ") || "0m";

    logActivity(
      task,
      "updated",
      `${req.user.name || "Someone"} logged ${durationLabel}`,
      req.user
    );

    await task.save();

    const result = await loadTaskWithRelations(task._id);

    return res.json({
      message: "Time logged",
      task: result,
    });
  } catch (error) {
    console.error("Log time error:", error);

    return res.status(500).json({
      message: "Could not log time",
    });
  }
};
