const { User, getUserProfile, publicUser } = require('../models/user');

async function getCurrentUser(req, res) {
  try {
    const user = await getUserProfile(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    return res.json(user);
  } catch (error) {
    console.error('Unable to load user profile:', error.message);
    return res.status(500).json({ error: 'Unable to load your profile right now.' });
  }
}

async function updateCurrentUser(req, res) {
  const { theme } = req.body || {};
  if (!['light', 'dark', 'auto'].includes(theme)) {
    return res.status(400).json({ error: 'Choose a valid theme.' });
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user.uid,
      { theme },
      { returnDocument: 'after', runValidators: true }
    );
    if (!user) return res.status(404).json({ error: 'User profile not found.' });
    return res.json(publicUser(user));
  } catch (error) {
    console.error('Unable to update user profile:', error.message);
    return res.status(500).json({ error: 'Unable to update your profile right now.' });
  }
}

module.exports = { getCurrentUser, updateCurrentUser };
