import { Router } from "express";
import openai from "../config/openai.js";
import { index } from "../config/pinecone.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { question, history = [] } = req.body;

    const queryEmbedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });

    const results = await index.query({
      vector: queryEmbedding.data[0].embedding,
      topK: 5,
      includeMetadata: true,
    });

    const matches = results.matches || [];

    const keywordMatches = matches.filter((m) =>
      m.metadata.text.toLowerCase().includes(question.toLowerCase())
    );

    const combinedMatches = [
      ...keywordMatches,
      ...matches.filter((m) => !keywordMatches.includes(m)),
    ].slice(0, 4);

    const context = combinedMatches.map((m) => m.metadata.text).join("\n");

    const sources = combinedMatches.map((m) => ({
      text: m.metadata.text,
      source: m.metadata.source,
      chunkIndex: m.metadata.chunkIndex,
    }));

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    const messages = [
      {
        role: "system",
        content: "Answer ONLY from the provided context. If not found, say 'I don't know based on the provided documents.'",
      },
      ...history.slice(-5).map((m) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.text,
      })),
      {
        role: "user",
        content: `Context:\n${context}\n\nQuestion: ${question}`,
      },
    ];

    const stream = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      stream: true,
      messages,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      res.write(text);
    }

    res.write("\n\n__SOURCES__" + JSON.stringify(sources));
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).end("Error processing request");
  }
});

export default router;
