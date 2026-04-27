import { Router } from "express";
import Chat from "../models/chat.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Create a new empty chat
router.post("/", requireAuth, async (req, res) => {
  try {
    const chat = await Chat.create({ userId: req.userId });
    res.status(201).json({ chatId: chat._id, title: chat.title, createdAt: chat.createdAt });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create chat" });
  }
});

// Get all chats for the logged-in user (no messages, just metadata)
router.get("/", requireAuth, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.userId })
      .select("_id title createdAt updatedAt")
      .sort({ updatedAt: -1 });
    res.json(chats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch chats" });
  }
});

// Get a single chat with all its messages
router.get("/:chatId", requireAuth, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.chatId, userId: req.userId });
    if (!chat) return res.status(404).json({ message: "Chat not found" });
    res.json(chat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch chat" });
  }
});

// Update chat title
router.patch("/:chatId/title", requireAuth, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ message: "Title is required" });
    const chat = await Chat.findOneAndUpdate(
      { _id: req.params.chatId, userId: req.userId },
      { title },
      { new: true }
    ).select("_id title");
    if (!chat) return res.status(404).json({ message: "Chat not found" });
    res.json(chat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update title" });
  }
});

// Delete a chat
router.delete("/:chatId", requireAuth, async (req, res) => {
  try {
    const chat = await Chat.findOneAndDelete({ _id: req.params.chatId, userId: req.userId });
    if (!chat) return res.status(404).json({ message: "Chat not found" });
    res.json({ message: "Chat deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete chat" });
  }
});

export default router;
