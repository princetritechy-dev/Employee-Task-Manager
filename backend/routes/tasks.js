const router = require("express").Router();

const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");

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

router.put(
  "/:id",
  controller.update
);

router.delete(
  "/:id",
  controller.remove
);

router.patch("/:id/start", auth, startTask);
router.patch("/:id/complete", auth, completeTask);


/*
|--------------------------------------------------------------------------
| ADMIN ROUTES
|--------------------------------------------------------------------------
*/

router.get(
  "/admin/all",
  adminOnly,
  controller.adminTasks
);

router.get(
  "/admin/summary",
  adminOnly,
  controller.summary
);

router.get(
  "/admin/employee/:id/summary",
  adminOnly,
  controller.employeeSummary
);


module.exports = router;