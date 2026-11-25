const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sgMail = require('@sendgrid/mail');
const EmailVerificationCode = require('../models/emailVerificationCode');
const { User, publicUser } = require('../models/user');

const otpLifetimeMs = 10 * 60 * 1000;
const otpResendDelayMs = 60 * 1000;
const maxOtpAttempts = 5;

function getDevelopmentOtp() {
  if (process.env.NODE_ENV !== 'development' || !process.env.DEV_OTP_CODE) {
    return null;
  }
  if (!/^\d{4}$/.test(process.env.DEV_OTP_CODE)) {
    throw new Error('DEV_OTP_CODE must contain exactly 4 digits.');
  }
  return process.env.DEV_OTP_CODE;
}

function hashOtp(uid, otp) {
  const secret = process.env.OTP_SECRET;
  if (!secret) {
    throw new Error('OTP_SECRET must be configured to use email verification.');
  }
  return crypto.createHmac('sha256', secret).update(`${uid}:${otp}`).digest();
}

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured.');
  }
  return jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
    subject: String(user._id),
    expiresIn: '7d',
  });
}

async function sendOtpEmail(email, otp) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !from) {
    const error = new Error('Email verification is not configured on the server.');
    error.status = 503;
    throw error;
  }

  sgMail.setApiKey(apiKey);
  await sgMail.send({
    to: email,
    from,
    subject: 'Your ReceiptAI email verification code',
    text: `Your ReceiptAI verification code is ${otp}. It expires in 10 minutes. Do not share it with anyone.`,
    html: `<p>Your ReceiptAI verification code is:</p><p style="font-size:24px;font-weight:bold">${otp}</p><p>This code expires in 10 minutes. Do not share it with anyone.</p>`,
  });
}

async function register(req, res) {
  const firstName = typeof req.body?.firstName === 'string' ? req.body.firstName.trim() : '';
  const lastName = typeof req.body?.lastName === 'string' ? req.body.lastName.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (
    !firstName ||
    firstName.length > 80 ||
    !lastName ||
    lastName.length > 80 ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    email.length > 254 ||
    password.length < 6 ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[!@#$%^&*(),.?":{}|<>]/.test(password)
  ) {
    return res.status(400).json({ error: 'Enter valid name, email, and a password that meets all requirements.' });
  }

  try {
    const user = await User.create({
      firstName,
      lastName,
      email,
      passwordHash: await bcrypt.hash(password, 12),
    });
    return res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'This email is already registered. Please log in.' });
    }
    console.error('Unable to register user:', error.message);
    return res.status(500).json({ error: 'Unable to create your account right now.' });
  }
}

async function login(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) {
    return res.status(400).json({ error: 'Enter your email and password.' });
  }

  try {
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    return res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    console.error('Unable to log in:', error.message);
    return res.status(500).json({ error: 'Unable to log in right now.' });
  }
}

async function sendOtp(req, res) {
  try {
    const user = await User.findById(req.user.uid);
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    if (user.emailVerified) return res.status(400).json({ error: 'This email is already verified.' });

    const developmentOtp = getDevelopmentOtp();
    const previous = await EmailVerificationCode.findOne({ userId: user._id });
    if (
      !developmentOtp &&
      previous &&
      Date.now() - previous.sentAt.getTime() < otpResendDelayMs
    ) {
      return res.status(429).json({ error: 'Please wait before requesting another code.' });
    }

    const otp = developmentOtp || crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    if (!developmentOtp) await sendOtpEmail(user.email, otp);
    await EmailVerificationCode.findOneAndUpdate(
      { userId: user._id },
      {
        otpHash: hashOtp(user.id, otp).toString('hex'),
        expiresAt: new Date(Date.now() + otpLifetimeMs),
        sentAt: new Date(),
        attempts: 0,
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    return res.json({
      message: developmentOtp ? 'Development verification code ready.' : 'Verification code sent.',
      developmentOtp: Boolean(developmentOtp),
    });
  } catch (error) {
    console.error('Unable to send verification code:', error.message);
    return res.status(error.status || 500).json({
      error: error.status ? error.message : 'Unable to send a verification code right now.',
    });
  }
}

async function verifyOtp(req, res) {
  const otp = typeof req.body?.otp === 'string' ? req.body.otp : '';
  let developmentOtp;
  try {
    developmentOtp = getDevelopmentOtp();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
  if (developmentOtp ? otp !== developmentOtp : !/^\d{6}$/.test(otp)) {
    return res.status(400).json({
      error: developmentOtp
        ? 'Enter the configured development verification code.'
        : 'Enter the 6-digit verification code.',
    });
  }

  try {
    const verification = await EmailVerificationCode.findOne({ userId: req.user.uid });
    if (!verification) {
      return res.status(400).json({ error: 'No active code. Request a new verification code.' });
    }
    if (verification.expiresAt.getTime() <= Date.now()) {
      await verification.deleteOne();
      return res.status(400).json({ error: 'The code expired. Request a new verification code.' });
    }
    if (verification.attempts >= maxOtpAttempts) {
      await verification.deleteOne();
      return res.status(429).json({ error: 'Too many attempts. Request a new verification code.' });
    }

    const submittedHash = hashOtp(req.user.uid, otp);
    const storedHash = Buffer.from(verification.otpHash, 'hex');
    if (submittedHash.length !== storedHash.length || !crypto.timingSafeEqual(submittedHash, storedHash)) {
      verification.attempts += 1;
      await verification.save();
      return res.status(400).json({ error: 'Incorrect verification code.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.uid,
      { emailVerified: true },
      { returnDocument: 'after' }
    );
    await verification.deleteOne();
    return res.json({ message: 'Email verified.', user: publicUser(user) });
  } catch (error) {
    console.error('Unable to verify email code:', error.message);
    return res.status(500).json({ error: 'Unable to verify the code right now.' });
  }
}

module.exports = { login, register, sendOtp, verifyOtp };
