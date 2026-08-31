/*
|--------------------------------------------------------------------------
| Admin OR Supervisor gate
|--------------------------------------------------------------------------
| Lets both roles through. This only checks the ROLE — it does NOT check
| whether a supervisor is actually assigned to the specific project/task
| they're touching. That scoping happens inside each controller, since it
| depends on which project is involved (a supervisor might manage Project
| A but not Project B).
|--------------------------------------------------------------------------
*/

module.exports = function supervisorOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  if (!["admin", "supervisor"].includes(req.user.role)) {
    return res.status(403).json({
      message: "Admin or supervisor access required",
    });
  }

  next();
};
