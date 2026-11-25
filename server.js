require('dotenv').config();

const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const financeRoutes = require('./routes/financeRoutes');
const insightRoutes = require('./routes/insightRoutes');
const mockPaymentRoutes = require('./routes/mockPaymentRoutes');
const razorpayPaymentRoutes = require('./routes/razorpayPaymentRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const port = Number(process.env.PORT) || 8082;
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/raseed';

app.use(cors());
app.post(
  '/api/payments/razorpay/webhook',
  express.raw({ type: 'application/json' }),
  require('./controllers/razorpayPaymentController').handleRazorpayWebhook
);
app.use(express.json({ limit: '8mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api/payments', mockPaymentRoutes);
app.use('/api/payments', razorpayPaymentRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/assistant/chat', chatRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Request body must be valid JSON.' });
  }

  console.error('Unhandled API error:', error.message);
  return res.status(500).json({ error: 'Internal server error.' });
});

async function startServer() {
  await mongoose.connect(mongoUri);
  return app.listen(port, () => {
    console.log(`ReceiptAI API server listening on port ${port} with MongoDB connected.`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Unable to connect to MongoDB:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, startServer };
