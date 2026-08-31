const router = require("express").Router();

const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");
const controller = require("../controllers/clientController");

router.use(auth);

// Anyone authenticated can see the client list (needed for the project
// dropdown to work for non-admins viewing/filtering projects too).
router.get("/", controller.list);

// Only admins manage clients — same rule as projects themselves.
router.post("/", adminOnly, controller.create);
router.put("/:id", adminOnly, controller.update);
router.delete("/:id", adminOnly, controller.remove);

module.exports = router;
