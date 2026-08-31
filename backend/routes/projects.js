const router = require("express").Router();
const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const controller = require("../controllers/projectController");

router.use(auth);
router.get("/", controller.list);
router.post("/", adminOnly, controller.create);   // admin only, like ClickUp Spaces
router.put("/:id", adminOnly, controller.update);
router.delete("/:id", adminOnly, controller.remove);

module.exports = router;