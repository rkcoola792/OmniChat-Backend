import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import connectDB from "./config/database.js";
import authRouter from "./routes/auth.js";
import uploadRouter from "./routes/upload.js";
import embedRouter from "./routes/embed.js";
import askRouter from "./routes/ask.js";
import chatRouter from "./routes/chat.js";

connectDB();

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",").map((o) => o.trim()) : []),
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRouter);
app.use("/upload", uploadRouter);
app.use("/embed", embedRouter);
app.use("/ask-stream", askRouter);
app.use("/chat", chatRouter);

app.listen(5000, () => console.log("Server running"));
