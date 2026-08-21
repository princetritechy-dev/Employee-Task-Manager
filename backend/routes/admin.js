const router = require("express").Router();

const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");

const controller = require("../controllers/adminController");


/*
|--------------------------------------------------------------------------
| ADMIN ROUTES
|--------------------------------------------------------------------------
| Every route in this file requires:
|
| 1. Valid JWT
| 2. Existing user
| 3. Active account
| 4. Admin role
|--------------------------------------------------------------------------
*/

router.use(auth);
router.use(adminOnly);


router.get(
  "/employees",
  controller.employees
);

router.get(
  "/dashboard",
  controller.dashboard
);



module.exports = router;