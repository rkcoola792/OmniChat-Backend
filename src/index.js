import "dotenv/config";
import express from "express";
import cors from "cors";
import connectDB from "./config/database.js";
import uploadRouter from "./routes/upload.js";
import embedRouter from "./routes/embed.js";
import askRouter from "./routes/ask.js";

connectDB();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/upload", uploadRouter);
app.use("/embed", embedRouter);
app.use("/ask-stream", askRouter);

app.listen(5000, () => console.log("Server running"));
