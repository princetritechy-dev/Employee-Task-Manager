require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { connectDB } = require("./config/database");

require("./models");

const app = express();

app.use(
  cors({
    origin: [process.env.CORS_ORIGIN]
  })
);

app.use(express.json());

/*
|--------------------------------------------------------------------------
| Never let browsers/proxies cache API responses
|--------------------------------------------------------------------------
| Without this, GET requests (like the dashboards' 6-second polling) can
| get silently served from the browser's HTTP cache instead of hitting
| the server — so one user's changes don't show up for another user
| until they force a hard reload.
|--------------------------------------------------------------------------
*/

app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "Task Manager API is running",
  });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/comments", require("./routes/comments"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/clients", require("./routes/clients"));

const PORT = Number(process.env.PORT || 5000);

(async () => {
  try {
    await connectDB();

    console.log("MongoDB connected");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Database startup failed:", error);
    process.exit(1);
  }
})();
