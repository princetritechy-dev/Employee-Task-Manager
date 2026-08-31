const router = require("express").Router();

const auth = require("../middleware/auth");
const supervisorOrAdmin = require("../middleware/supervisorOrAdmin");
const adminOnly = require("../middleware/admin");

const controller = require("../controllers/adminController");


/*
|--------------------------------------------------------------------------
| ADMIN / SUPERVISOR ROUTES
|--------------------------------------------------------------------------
| Every route in this file requires:
|
| 1. Valid JWT
| 2. Existing user
| 3. Active account
| 4. Admin OR supervisor role — controllers scope the data further for
|    supervisors (their managed projects only), so nothing here leaks
|    company-wide data to a supervisor.
|--------------------------------------------------------------------------
*/

router.use(auth);
router.use(supervisorOrAdmin);


router.get(
  "/employees",
  controller.employees
);

router.get(
  "/dashboard",
  controller.dashboard
);

router.get(
  "/users",
  adminOnly,
  controller.allUsers
);

router.post(
  "/users",
  adminOnly,
  controller.createUser
);

router.put(
  "/users/:id",
  adminOnly,
  controller.updateUser
);

router.delete(
  "/users/:id",
  adminOnly,
  controller.deleteUser
);



module.exports = router;