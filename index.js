import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import multer from "multer";
import { Pinecone } from "@pinecone-database/pinecone";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Pinecone client
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});
const index = pc.index("rag-app");

//function for uploading files
const upload = multer({ dest: "uploads/" });
app.post("/upload", upload.single("file"), async (req, res) => {
  const fs = await import("fs");

  const fileBuffer = fs.readFileSync(req.file.path);
  const isPdf =
    req.file.mimetype === "application/pdf" ||
    req.file.originalname?.endsWith(".pdf");
  const text = isPdf
    ? (await pdfParse(fileBuffer)).text
    : fileBuffer.toString("utf-8");

  if (!text || text.trim().length === 0) {
    return res
      .status(400)
      .json({
        error:
          "Could not extract text from file. The PDF may be image-based or corrupted.",
      });
  }

  const chunks = chunkText(text).filter((c) => c.trim().length > 0);

  if (chunks.length === 0) {
    return res
      .status(400)
      .json({ error: "No text content found in the file." });
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

//function to chunk text into smaller pieces
function chunkText(text, size = 200, overlap = 50) {
  const words = text.split(" ");
  const chunks = [];

  for (let i = 0; i < words.length; i += size - overlap) {
    chunks.push(words.slice(i, i + size).join(" "));
  }

  return chunks;
}

//create embedding for text
app.post("/embed", async (req, res) => {
  const { text } = req.body;

  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  res.json({
    embedding: embedding.data[0].embedding,
  });
});
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// app.post("/chat", async (req, res) => {
//   const { message } = req.body;

//   const response = await openai.chat.completions.create({
//     model: "gpt-4.1-mini",
//     messages: [{ role: "user", content: message }]
//   });

//   res.json({
//     reply: response.choices[0].message.content
//   });
// });

//function to handle question answering
app.post("/ask-stream", async (req, res) => {
  try {
    const { question, history = [] } = req.body;

    // 🔹 1. Create query embedding
    const queryEmbedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });

    // 🔹 2. Vector search
    const results = await index.query({
      vector: queryEmbedding.data[0].embedding,
      topK: 5, 
      includeMetadata: true,
    });

    // 🔹 3. Extract matches
    const matches = results.matches || [];

    // 🔥 Hybrid search (simple keyword boost)
    const keywordMatches = matches.filter((m) =>
      m.metadata.text.toLowerCase().includes(question.toLowerCase())
    );

    // Combine (avoid duplicates)
    const combinedMatches = [
      ...keywordMatches,
      ...matches.filter((m) => !keywordMatches.includes(m)),
    ].slice(0, 4); // final top 4

    // 🔹 4. Build context
    const context = combinedMatches
      .map((m) => m.metadata.text)
      .join("\n");

    // 🔹 5. Build sources (for frontend)
    const sources = combinedMatches.map((m) => ({
      text: m.metadata.text,
      source: m.metadata.source,
      chunkIndex: m.metadata.chunkIndex,
    }));

    // 🔹 6. Set streaming headers
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    // 🔹 7. Build messages (with memory)
    const messages = [
      {
        role: "system",
        content:
          "Answer ONLY from the provided context. If not found, say 'I don't know based on the provided documents.'",
      },

      // 🧠 Multi-turn memory (last 5)
      ...history.slice(-5).map((m) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.text,
      })),

      {
        role: "user",
        content: `Context:\n${context}\n\nQuestion: ${question}`,
      },
    ];

    // 🔹 8. Start streaming
    const stream = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      stream: true,
      messages,
    });

    // 🔹 9. Send stream chunks
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      res.write(text);
    }

    // 🔥 10. Send sources at the END
    res.write("\n\n__SOURCES__" + JSON.stringify(sources));

    res.end();

  } catch (error) {
    console.error(error);
    res.status(500).end("Error processing request");
  }
});
app.listen(5000, () => console.log("Server running"));
