// routes/projects.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const canCreateProject = require("../middleware/canCreateProject");
const controller = require("../controllers/projectController");

router.use(auth);
router.get("/", controller.list);
router.post("/", canCreateProject, controller.create);   // admin + user
router.put("/:id", adminOnly, controller.update);
router.delete("/:id", adminOnly, controller.remove);

module.exports = router;