const mongoose = require("mongoose");
const { Task, TaskComment, User } = require("../models");

/*
|--------------------------------------------------------------------------
| Serialize comment
|--------------------------------------------------------------------------
| Attaches the admin who wrote the comment under "Admin" (matching the old
| Sequelize `as: "Admin"` include) while keeping the raw adminId/taskId
| fields on the object.
|--------------------------------------------------------------------------
*/

function serialize(comment, admin) {
    const json = comment.toJSON();
    json.Admin = admin ? admin.toJSON() : null;
    return json;
}

exports.createComment = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { comment } = req.body;

        if (!comment || !comment.trim()) {
            return res.status(400).json({
                message: "Comment is required",
            });
        }

        if (!mongoose.isValidObjectId(taskId)) {
            return res.status(404).json({
                message: "Task not found",
            });
        }

        const task = await Task.findById(taskId);

        if (!task) {
            return res.status(404).json({
                message: "Task not found",
            });
        }

        const newComment = await TaskComment.create({
            taskId: task._id,
            adminId: req.user._id,
            comment: comment.trim(),
        });

        const admin = await User.findById(req.user._id).select("name email");

        res.status(201).json(serialize(newComment, admin));
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: error.message,
        });
    }
};

exports.getComments = async (req, res) => {
    try {
        const { taskId } = req.params;

        if (!mongoose.isValidObjectId(taskId)) {
            return res.json([]);
        }

        const comments = await TaskComment.find({ taskId }).sort({
            createdAt: 1,
        });

        const adminIds = [...new Set(comments.map((c) => c.adminId.toString()))];

        const admins = await User.find({ _id: { $in: adminIds } }).select(
            "name email"
        );

        const adminsById = new Map(admins.map((a) => [a.id, a]));

        res.json(
            comments.map((c) => serialize(c, adminsById.get(c.adminId.toString())))
        );
    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};

exports.deleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;

        if (!mongoose.isValidObjectId(commentId)) {
            return res.status(404).json({
                message: "Comment not found",
            });
        }

        const comment = await TaskComment.findById(commentId);

        if (!comment) {
            return res.status(404).json({
                message: "Comment not found",
            });
        }

        await comment.deleteOne();

        res.json({
            message: "Comment deleted",
        });
    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};
