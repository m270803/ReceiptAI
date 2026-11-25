const express = require('express');
const { scanReceipt } = require('../controllers/receiptController');
const requireUser = require('../middleware/requireUser');

const router = express.Router();

router.post('/scan', requireUser, scanReceipt);

module.exports = router;
