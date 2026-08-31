const router = require("express").Router();

const auth = require("../middleware/auth");
const controller = require("../controllers/chatController");

/*
|--------------------------------------------------------------------------
| CHAT ROUTES
|--------------------------------------------------------------------------
| Any authenticated, active user — admin, supervisor, or employee — can
| use chat. There's no role restriction here on purpose: everyone should
| be able to reach the Team Room and message anyone else directly.
|--------------------------------------------------------------------------
*/

router.use(auth);

router.get("/contacts", controller.contacts);

router.get("/team", controller.getTeamMessages);
router.post("/team", controller.postTeamMessage);

router.get("/dm/:userId", controller.getDM);
router.post("/dm/:userId", controller.postDM);

router.patch("/message/:id", controller.editMessage);
router.delete("/message/:id", controller.deleteMessage);

router.post("/read", controller.markRead);
router.get("/unread", controller.unreadCounts);

router.post("/typing", controller.pingTyping);
router.get("/typing", controller.getTypingStatus);

module.exports = router;
