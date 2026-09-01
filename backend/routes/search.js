const router = require("express").Router();

const auth = require("../middleware/auth");
const controller = require("../controllers/searchController");

router.use(auth);

router.get("/", controller.search);

module.exports = router;
