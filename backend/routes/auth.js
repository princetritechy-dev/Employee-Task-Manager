const router = require("express").Router();
const controller = require("../controllers/authController");
const auth = require("../middleware/auth");
const {
  forgotPassword,
  resetPassword
} = require("../controllers/authController");

router.post("/login", controller.login);
router.get("/me", auth, controller.me);
router.post(
  "/forgot-password",
  forgotPassword
);


router.patch(
  "/reset-password/:token",
  resetPassword
);

module.exports = router;
