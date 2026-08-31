const router = require("express").Router();

const auth = require("../middleware/auth");

const {
    createComment,
    getComments,
    deleteComment,
} = require("../controllers/commentController");

router.use(auth);

/*
    Anyone with task access (owner, assignee, or admin) can READ comments
*/

router.get(
    "/task/:taskId",
    getComments
);

/*
    Anyone with task access (owner, assignee, or admin) can CREATE comments
*/

router.post(
    "/task/:taskId",
    createComment
);

/*
    Admin, or the comment's own author, can DELETE it
*/

router.delete(
    "/:commentId",
    deleteComment
);

module.exports = router;