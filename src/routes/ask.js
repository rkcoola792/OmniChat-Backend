import { Router } from "express";
import openai from "../config/openai.js";
import { index } from "../config/pinecone.js";
import Chat from "../models/chat.js";
import { optionalAuth } from "../middleware/auth.js";

const router = Router();

router.post("/", optionalAuth, async (req, res) => {
  try {
    const { question, history = [], chatId } = req.body;

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

    let fullResponse = "";
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      fullResponse += text;
      res.write(text);
    }

    res.write("\n\n__SOURCES__" + JSON.stringify(sources));
    res.end();

    // Persist messages to the chat after streaming completes
    if (chatId) {
      if (!req.userId) {
        console.warn("[ask] chatId provided but user not authenticated — cookie may be missing from streaming request");
      } else {
        const chat = await Chat.findOne({ _id: chatId, userId: req.userId });
        if (!chat) {
          console.warn("[ask] chat not found for chatId:", chatId, "userId:", req.userId);
        } else {
          chat.messages.push({ role: "user", content: question });
          chat.messages.push({ role: "assistant", content: fullResponse, sources });

          // Auto-title from the first user message
          if (chat.title === "New Chat" && chat.messages.length <= 2) {
            chat.title = question.slice(0, 60) + (question.length > 60 ? "..." : "");
          }

          await chat.save();
        }
      }
    }
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).end("Error processing request");
    } else {
      res.end();
    }
  }
});

export default router;
