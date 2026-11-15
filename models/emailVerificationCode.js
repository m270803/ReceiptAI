const mongoose = require('mongoose');

const emailVerificationCodeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  sentAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
});

module.exports =
  mongoose.models.EmailVerificationCode ||
  mongoose.model('EmailVerificationCode', emailVerificationCodeSchema);
