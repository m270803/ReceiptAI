const { randomBytes } = require('crypto');
const { User } = require('../models/user');

const INITIAL_BALANCE_PAISE = 1000000;
const MAX_PAYMENT_PAISE = 10000000;
const UPI_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}@[A-Za-z0-9][A-Za-z0-9.-]{1,99}$/;

async function getWalletUser(uid) {
  await User.updateOne(
    { _id: uid, mockWalletBalancePaise: { $exists: false } },
    { $set: { mockWalletBalancePaise: INITIAL_BALANCE_PAISE } }
  );
  return User.findById(uid).select('mockWalletBalancePaise mockPayments');
}

function serializePayment(payment) {
  const record = typeof payment.toObject === 'function' ? payment.toObject() : payment;
  return {
    id: String(record._id),
    reference: record.reference,
    upiId: record.upiId,
    payeeName: record.payeeName || '',
    amount: record.amountPaise / 100,
    status: record.status,
    createdAt: record.createdAt,
  };
}

async function getMockWallet(req, res) {
  try {
    const user = await getWalletUser(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User profile not found.' });

    return res.json({
      balance: user.mockWalletBalancePaise / 100,
      payments: user.mockPayments.slice(0, 100).map(serializePayment),
    });
  } catch (error) {
    console.error('Unable to load demo wallet:', error.message);
    return res.status(500).json({ error: 'Unable to load the demo wallet right now.' });
  }
}

async function makeMockPayment(req, res) {
  const upiId = typeof req.body?.upiId === 'string' ? req.body.upiId.trim() : '';
  const payeeName = typeof req.body?.payeeName === 'string' ? req.body.payeeName.trim() : '';
  const amount = Number(req.body?.amount);
  const amountPaise = Math.round(amount * 100);

  if (
    !UPI_ID_PATTERN.test(upiId) ||
    payeeName.length > 120 ||
    !Number.isFinite(amount) ||
    amountPaise <= 0 ||
    amountPaise > MAX_PAYMENT_PAISE
  ) {
    return res.status(400).json({ error: 'Enter a valid UPI ID and payment amount up to ₹100,000.' });
  }

  try {
    const user = await getWalletUser(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User profile not found.' });

    const payment = {
      reference: `MOCK-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`,
      upiId,
      payeeName,
      amountPaise,
      status: 'SIMULATED',
      createdAt: new Date(),
    };
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user.uid, mockWalletBalancePaise: { $gte: amountPaise } },
      {
        $inc: { mockWalletBalancePaise: -amountPaise },
        $push: {
          mockPayments: {
            $each: [payment],
            $position: 0,
            $slice: 100,
          },
        },
      },
      { returnDocument: 'after', runValidators: true }
    ).select('mockWalletBalancePaise mockPayments');

    if (!updatedUser) {
      const currentUser = await getWalletUser(req.user.uid);
      if (!currentUser) return res.status(404).json({ error: 'User profile not found.' });
      return res.status(400).json({
        error: 'Not enough demo funds for this payment.',
        balance: currentUser.mockWalletBalancePaise / 100,
      });
    }

    const savedPayment = updatedUser.mockPayments.find(
      (entry) => entry.reference === payment.reference
    );
    return res.status(201).json({
      balance: updatedUser.mockWalletBalancePaise / 100,
      payment: serializePayment(savedPayment),
    });
  } catch (error) {
    console.error('Unable to make demo payment:', error.message);
    return res.status(500).json({ error: 'Unable to complete the demo payment right now.' });
  }
}

module.exports = { getMockWallet, makeMockPayment };
