const { getFinancialInsights } = require('../models/user');

async function getInsights(req, res) {
  try {
    const insights = await getFinancialInsights(req.user.uid);
    return res.json(insights);
  } catch (error) {
    console.error('Unable to load financial insights:', error.message);
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to load your insights right now.' });
  }
}

module.exports = { getInsights };
