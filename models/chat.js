const mongoose = require('mongoose');

const CHAT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const chatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  chatId: { type: String, required: true, match: CHAT_ID_PATTERN },
  title: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  messages: [
    {
      role: { type: String, enum: ['user', 'assistant'], required: true },
      content: { type: String, required: true, maxlength: 2000 },
      createdAt: { type: Date, default: Date.now },
    },
  ],
});

chatSchema.index({ userId: 1, chatId: 1 }, { unique: true });

const Chat = mongoose.models.Chat || mongoose.model('Chat', chatSchema);

function validateChatId(chatId) {
  if (typeof chatId !== 'string' || !CHAT_ID_PATTERN.test(chatId)) {
    throw new Error('Invalid chat ID.');
  }
}

async function saveChatTurn({ uid, chatId, userText, assistantText }) {
  validateChatId(chatId);
  const now = new Date();
  const chat = await Chat.findOneAndUpdate(
    { userId: uid, chatId },
    {
      $setOnInsert: { title: userText.slice(0, 80), createdAt: now },
      $set: { updatedAt: now },
      $push: {
        messages: {
          $each: [
            { role: 'user', content: userText, createdAt: now },
            { role: 'assistant', content: assistantText, createdAt: now },
          ],
          $slice: -200,
        },
      },
    },
    { upsert: true, returnDocument: 'after' }
  );
  return chat;
}

async function listUserChats(uid) {
  const chats = await Chat.find({ userId: uid })
    .sort({ updatedAt: -1 })
    .limit(50)
    .select('chatId title createdAt updatedAt');
  return chats.map((chat) => ({
    id: chat.chatId,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  }));
}

async function getChatMessages(uid, chatId) {
  validateChatId(chatId);
  const chat = await Chat.findOne({ userId: uid, chatId });
  if (!chat) return null;

  return {
    chat: {
      id: chat.chatId,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    },
    messages: chat.messages.slice(-200).map((message) => ({
      id: String(message._id),
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    })),
  };
}

module.exports = { CHAT_ID_PATTERN, getChatMessages, listUserChats, saveChatTurn, validateChatId };
