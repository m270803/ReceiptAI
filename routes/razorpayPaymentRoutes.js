const express = require('express');
const requireUser = require('../middleware/requireUser');
const {
  createPaymentLink,
  getPaymentHistory,
  verifyPayment,
} = require('../controllers/razorpayPaymentController');

const router = express.Router();

router.use(requireUser);
router.get('/razorpay', getPaymentHistory);
router.post('/razorpay/create', createPaymentLink);
router.post('/razorpay/verify', verifyPayment);

module.exports = router;
