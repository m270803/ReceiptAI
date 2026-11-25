const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

function requireUser(req, res, next) {
  const authorization = req.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(match[1], process.env.JWT_SECRET);
    if (typeof payload.sub !== 'string' || !mongoose.isValidObjectId(payload.sub)) {
      return res.status(401).json({ error: 'Invalid or expired authentication token.' });
    }

    req.user = { uid: payload.sub, email: payload.email };
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

module.exports = requireUser;
