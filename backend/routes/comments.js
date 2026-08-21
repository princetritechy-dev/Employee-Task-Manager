const router = require("express").Router();

const auth = require("../middleware/auth");
const adminOnly = require("../middleware/admin");

const {
    createComment,
    getComments,
    deleteComment,
} = require("../controllers/commentController");

router.use(auth);

/*
    Admin + Employee can READ comments
*/

router.get(
    "/task/:taskId",
    getComments
);

/*
    Only Admin can CREATE comments
*/

router.post(
    "/task/:taskId",
    adminOnly,
    createComment
);

/*
    Only Admin can DELETE comments
*/

router.delete(
    "/:commentId",
    adminOnly,
    deleteComment
);

module.exports = router;