const {
  CHAT_ID_PATTERN,
  getChatMessages,
  listUserChats,
  saveChatTurn,
} = require('../models/chat');
const { getFinancialInsights } = require('../models/user');

async function getChats(req, res) {
  try {
    return res.json({ chats: await listUserChats(req.user.uid) });
  } catch (error) {
    console.error('Unable to load chats:', error.message);
    return res.status(500).json({ error: 'Unable to load your chats right now.' });
  }
}

async function getChat(req, res) {
  try {
    const result = await getChatMessages(req.user.uid, req.params.chatId);
    if (!result) {
      return res.status(404).json({ error: 'Chat not found.' });
    }

    return res.json(result);
  } catch (error) {
    if (error.message === 'Invalid chat ID.') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Unable to load chat:', error.message);
    return res.status(500).json({ error: 'Unable to load this chat right now.' });
  }
}

function validateMessages(messages, chatId) {
  return (
    typeof chatId === 'string' &&
    CHAT_ID_PATTERN.test(chatId) &&
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.length <= 20 &&
    messages.every(
      (message) =>
        message &&
        ['user', 'assistant'].includes(message.role) &&
        typeof message.content === 'string' &&
        message.content.trim().length > 0 &&
        message.content.length <= 2000
    ) &&
    messages[messages.length - 1].role === 'user'
  );
}

async function sendChatMessage(req, res) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Groq is not configured on the server yet.' });
  }

  const { messages, chatId } = req.body || {};
  if (!validateMessages(messages, chatId)) {
    return res.status(400).json({ error: 'Send a valid chat ID and up to 20 valid chat messages.' });
  }

  try {
    const insights = await getFinancialInsights(req.user.uid);
    const financialContext = [
      `Current month (${new Date().toLocaleString('en', { month: 'long', year: 'numeric' })}) totals in INR: income ₹${insights.totalIncome.toFixed(2)}, expenses ₹${insights.totalExpenses.toFixed(2)}, net savings ₹${insights.savings.toFixed(2)}.`,
      `Top spending category: ${insights.topCategory || 'no recorded spending yet'}.`,
      `Budget categories and limits: ${JSON.stringify(insights.budgets)}.`,
      `Savings goals: ${JSON.stringify(insights.savingsGoals)}.`,
    ].join(' ');
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        messages: [
          {
            role: 'system',
            content:
              `You are ReceiptAI, a friendly personal-finance app assistant. Explain app features clearly and give general budgeting and savings guidance. Use the user financial summary below when answering questions about their own finances. If a value is missing, say so instead of guessing. Do not present financial guidance as guaranteed or professional advice.\n\nUser financial summary: ${financialContext}`,
          },
          ...messages.map(({ role, content }) => ({ role, content: content.trim() })),
        ],
        max_completion_tokens: 300,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Assistant provider returned status:', response.status);
      return res.status(502).json({ error: 'The assistant could not answer right now.' });
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string' || !reply.trim()) {
      return res.status(502).json({ error: 'The assistant returned an empty response.' });
    }

    await saveChatTurn({
      uid: req.user.uid,
      chatId,
      userText: messages[messages.length - 1].content.trim(),
      assistantText: reply.trim(),
    });
    return res.json({ reply: reply.trim() });
  } catch (error) {
    console.error('Assistant request failed:', error.message);
    return res.status(502).json({ error: 'The assistant could not answer right now.' });
  }
}

module.exports = { getChat, getChats, sendChatMessage };
