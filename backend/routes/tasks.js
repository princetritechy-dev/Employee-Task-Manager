const router = require("express").Router();

const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const supervisorOrAdmin = require("../middleware/supervisorOrAdmin");

const controller = require("../controllers/taskController");

const {
  create,
  myTasks,
  update,
  remove,
  adminTasks,
  summary,
  employeeSummary,
  startTask,
  completeTask,
  reopenTask,
  reorderTask,
  toggleSubtask,
  myWork,
  redoTask,
} = require("../controllers/taskController");


/*
|--------------------------------------------------------------------------
| AUTHENTICATED USER ROUTES
|--------------------------------------------------------------------------
*/

router.use(auth);


/*
|--------------------------------------------------------------------------
| Employee routes
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  controller.create
);

router.get(
  "/my",
  controller.myTasks
);

router.get(
  "/assigned-to-me",
  controller.myWork
);

router.get(
  "/project/:id",
  controller.projectTasks
);

router.put(
  "/:id",
  adminOnly,
  controller.update
);

router.delete(
  "/:id",
  adminOnly,
  controller.remove
);

router.patch("/:id/start", auth, startTask);
router.patch("/:id/complete", auth, completeTask);
router.patch("/:id/reopen", auth, reopenTask);
router.patch("/:id/redo", auth, redoTask);
router.patch("/:id/reorder", auth, reorderTask);
router.patch("/:id/move", auth, controller.moveTask);
router.patch("/:id/log-time", auth, controller.logTime);
router.patch("/:id/subtasks/:subtaskId", auth, toggleSubtask);


/*
|--------------------------------------------------------------------------
| ADMIN / SUPERVISOR ROUTES
|--------------------------------------------------------------------------
| Routes a supervisor can reach too are gated by supervisorOrAdmin; the
| controllers scope the actual data/permissions to whichever projects
| that supervisor is assigned to. Routes with no supervisor use case
| (or that are unused/legacy) stay strictly admin-only.
|--------------------------------------------------------------------------
*/

router.get(
  "/admin/all",
  supervisorOrAdmin,
  controller.adminTasks
);

router.get(
  "/admin/summary",
  adminOnly,
  controller.summary
);

router.get(
  "/admin/employee/:id/summary",
  supervisorOrAdmin,
  controller.employeeSummary
);

router.patch(
  "/admin/:id/move",
  adminOnly,
  controller.adminMoveTask
);

router.patch(
  "/admin/:id/lock",
  supervisorOrAdmin,
  controller.lockTask
);

router.patch(
  "/admin/:id/unlock",
  supervisorOrAdmin,
  controller.unlockTask
);


module.exports = router;