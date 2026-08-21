const mongoose = require("mongoose");
require("dotenv").config();

/*
|--------------------------------------------------------------------------
| MongoDB connection
|--------------------------------------------------------------------------
| MONGODB_URI examples:
|   Local:  mongodb://127.0.0.1:27017/task_manager
|   Atlas:  mongodb+srv://<user>:<password>@cluster0.mongodb.net/task_manager
|--------------------------------------------------------------------------
*/

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/task_manager";

async function connectDB() {
  mongoose.set("strictQuery", true);

  await mongoose.connect(MONGODB_URI);

  return mongoose.connection;
}

module.exports = { mongoose, connectDB };
