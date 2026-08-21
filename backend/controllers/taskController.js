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

function serializeTask(task, { project, employee, comments = [], adminsById = new Map() } = {}) {
  const json = task.toJSON();

  json.Project = project ? project.toJSON() : null;
  json.Employee = employee ? employee.toJSON() : null;

  json.Comments = comments.map((c) =>
    serializeComment(c, adminsById.get(c.adminId.toString()))
  );

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

  const [project, employee, comments] = await Promise.all([
    Project.findById(task.projectId).select("name status"),
    User.findById(task.userId).select("name email"),
    TaskComment.find({ taskId: task._id }).sort({ createdAt: 1 }),
  ]);

  const adminIds = [...new Set(comments.map((c) => c.adminId.toString()))];
  const admins = await User.find({ _id: { $in: adminIds } }).select("name email");
  const adminsById = new Map(admins.map((a) => [a.id, a]));

  return serializeTask(task, { project, employee, comments, adminsById });
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

  const [projects, employees, comments] = await Promise.all([
    Project.find({ _id: { $in: projectIds } }).select("name status"),
    User.find({ _id: { $in: userIds } }).select("name email"),
    TaskComment.find({ taskId: { $in: taskIds } }).sort({ createdAt: 1 }),
  ]);

  const projectsById = new Map(projects.map((p) => [p.id, p]));
  const employeesById = new Map(employees.map((u) => [u.id, u]));

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
| userId ALWAYS comes from req.user._id.
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
    | CREATE TASK
    |--------------------------------------------------------------------------
    */

    const task = await Task.create({
      userId: req.user._id,

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

    await task.save();






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
    | Find employee task
    |--------------------------------------------------------------------------
    */

    const task = await Task.findOne({
      _id: taskId,
      userId: req.user._id,
    });



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
    } = req.body;



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
    | Find employee task
    |--------------------------------------------------------------------------
    */

    const task = await Task.findOne({
      _id: taskId,
      userId: req.user._id,
    });


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
