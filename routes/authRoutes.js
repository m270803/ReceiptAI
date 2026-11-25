const express = require('express');
const { login, register, sendOtp, verifyOtp } = require('../controllers/authController');
const requireUser = require('../middleware/requireUser');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/send-otp', requireUser, sendOtp);
router.post('/verify-otp', requireUser, verifyOtp);

module.exports = router;
