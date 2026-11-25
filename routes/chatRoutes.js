const express = require('express');
const { getChat, getChats, sendChatMessage } = require('../controllers/chatController');
const requireUser = require('../middleware/requireUser');

const router = express.Router();

router.get('/', requireUser, getChats);
router.get('/:chatId', requireUser, getChat);
router.post('/', requireUser, sendChatMessage);

module.exports = router;
