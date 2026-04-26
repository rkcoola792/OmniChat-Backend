import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/database.js";
import authRouter from "./routes/auth.js";
import uploadRouter from "./routes/upload.js";
import embedRouter from "./routes/embed.js";
import askRouter from "./routes/ask.js";

connectDB();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRouter);
app.use("/upload", uploadRouter);
app.use("/embed", embedRouter);
app.use("/ask-stream", askRouter);

app.listen(5000, () => console.log("Server running"));
