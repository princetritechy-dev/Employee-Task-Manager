module.exports = (req, res, next) => {
  if (!["admin", "employee"].includes(req.user.role)) {
    return res.status(403).json({ message: "Not authorized to create projects" });
  }
  next();
};
