import { Router } from "express";
import openai from "../config/openai.js";

const router = Router();

router.post("/", async (req, res) => {
  const { text } = req.body;

  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  res.json({ embedding: embedding.data[0].embedding });
});

export default router;
