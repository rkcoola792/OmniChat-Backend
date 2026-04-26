import { Router } from "express";
import multer from "multer";
import { createRequire } from "module";
import openai from "../config/openai.js";
import { index } from "../config/pinecone.js";
import { chunkText } from "../utils/chunkText.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const router = Router();
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("file"), async (req, res) => {
  const fs = await import("fs");

  const fileBuffer = fs.readFileSync(req.file.path);
  const isPdf =
    req.file.mimetype === "application/pdf" ||
    req.file.originalname?.endsWith(".pdf");
  const text = isPdf
    ? (await pdfParse(fileBuffer)).text
    : fileBuffer.toString("utf-8");

  if (!text || text.trim().length === 0) {
    return res.status(400).json({
      error: "Could not extract text from file. The PDF may be image-based or corrupted.",
    });
  }

  const chunks = chunkText(text).filter((c) => c.trim().length > 0);

  if (chunks.length === 0) {
    return res.status(400).json({ error: "No text content found in the file." });
  }

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunks[i],
    });
    await index.upsert({
      records: [
        {
          id: `chunk-${i}`,
          values: embedding.data[0].embedding,
          metadata: {
            text: chunks[i],
            source: req.file.originalname,
            chunkIndex: i,
          },
        },
      ],
    });
  }

  res.json({ message: "File processed & stored!" });
});

export default router;
