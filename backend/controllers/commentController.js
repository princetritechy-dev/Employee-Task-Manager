const mongoose = require("mongoose");
const { Task, TaskComment, User } = require("../models");

function serialize(comment, admin) {
    const json = comment.toJSON();
    json.Admin = admin ? admin.toJSON() : null;
    return json;
}

function canAccessTask(user, task) {
    if (user.role === "admin") return true;
    if (String(task.userId) === String(user._id)) return true;
    return (task.assigneeIds || []).some(
        (id) => String(id) === String(user._id)
    );
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

        if (!canAccessTask(req.user, task)) {
            return res.status(403).json({
                message: "You don't have access to this task",
            });
        }

        const newComment = await TaskComment.create({
            taskId: task._id,
            adminId: req.user._id,
            comment: comment.trim(),
        });

        const admin = await User.findById(req.user._id).select("name email role avatarId");

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

        const task = await Task.findById(taskId);

        if (!task || !canAccessTask(req.user, task)) {
            return res.json([]);
        }

        const comments = await TaskComment.find({ taskId }).sort({
            createdAt: 1,
        });

        const adminIds = [...new Set(comments.map((c) => c.adminId.toString()))];

        const admins = await User.find({ _id: { $in: adminIds } }).select(
            "name email role avatarId"
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

        const isAuthor = String(comment.adminId) === String(req.user._id);

        if (req.user.role !== "admin" && !isAuthor) {
            return res.status(403).json({
                message: "You can only delete your own comments",
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