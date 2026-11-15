const express = require('express');
const { getInsights } = require('../controllers/insightsController');
const requireUser = require('../middleware/requireUser');

const router = express.Router();

router.get('/', requireUser, getInsights);

module.exports = router;
