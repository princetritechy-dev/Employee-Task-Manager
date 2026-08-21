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
