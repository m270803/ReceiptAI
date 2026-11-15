const express = require('express');
const requireUser = require('../middleware/requireUser');
const { getMockWallet, makeMockPayment } = require('../controllers/mockPaymentController');

const router = express.Router();

router.use(requireUser);
router.get('/mock', getMockWallet);
router.post('/mock', makeMockPayment);

module.exports = router;
