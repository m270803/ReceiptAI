const express = require('express');
const { getCurrentUser, updateCurrentUser } = require('../controllers/userController');
const requireUser = require('../middleware/requireUser');

const router = express.Router();

router.get('/me', requireUser, getCurrentUser);
router.patch('/me', requireUser, updateCurrentUser);

module.exports = router;
