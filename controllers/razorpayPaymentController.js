const { createHmac, randomBytes, timingSafeEqual } = require('crypto');
const Razorpay = require('razorpay');
const { User } = require('../models/user');

const MAX_PAYMENT_PAISE = 10000000;
const categories = ['Food', 'Rent', 'Travel', 'Shopping', 'Utilities', 'Other'];

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    const error = new Error('Razorpay is not configured on the server.');
    error.status = 503;
    throw error;
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function serializePayment(payment) {
  const record = typeof payment.toObject === 'function' ? payment.toObject() : payment;
  return {
    id: String(record._id),
    reference: record.reference,
    paymentLinkId: record.paymentLinkId,
    shortUrl: record.shortUrl,
    title: record.title,
    category: record.category,
    amount: record.amountPaise / 100,
    status: record.status,
    createdAt: record.createdAt,
    paidAt: record.paidAt,
  };
}

async function savePaidPayment(uid, payment, gatewayPayment) {
  const gatewayTimestamp = Number(gatewayPayment.updated_at);
  const paidAt =
    Number.isFinite(gatewayTimestamp) && gatewayTimestamp > 0
      ? new Date(gatewayTimestamp * 1000)
      : new Date();
  const capturedPayment = gatewayPayment.payments?.find(
    (entry) => entry.status === 'captured'
  );

  await User.findOneAndUpdate(
    {
      _id: uid,
      razorpayPayments: {
        $elemMatch: {
          reference: payment.reference,
          paymentLinkId: payment.paymentLinkId,
          status: { $ne: 'paid' },
        },
      },
    },
    {
      $set: {
        'razorpayPayments.$[payment].status': 'paid',
        'razorpayPayments.$[payment].paidAt': paidAt,
        'razorpayPayments.$[payment].paymentId': capturedPayment?.payment_id || '',
      },
      $push: {
        expenses: {
          title: payment.title,
          amount: payment.amountPaise / 100,
          category: payment.category,
          date: paidAt,
          createdAt: paidAt,
          paymentProvider: 'razorpay',
          paymentReference: payment.reference,
          paymentLinkId: payment.paymentLinkId,
          paymentId: capturedPayment?.payment_id || '',
          paymentMethod: capturedPayment?.method || 'upi',
        },
      },
    },
    {
      arrayFilters: [
        {
          'payment.reference': payment.reference,
          'payment.paymentLinkId': payment.paymentLinkId,
          'payment.status': { $ne: 'paid' },
        },
      ],
    }
  );
}

async function getPaymentHistory(req, res) {
  try {
    const user = await User.findById(req.user.uid).select('razorpayPayments');
    if (!user) return res.status(404).json({ error: 'User profile not found.' });
    return res.json(user.razorpayPayments.slice(0, 100).map(serializePayment));
  } catch (error) {
    console.error('Unable to load Razorpay payment history:', error.message);
    return res.status(500).json({ error: 'Unable to load payment history right now.' });
  }
}

async function createPaymentLink(req, res) {
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const category = typeof req.body?.category === 'string' ? req.body.category : '';
  const amount = Number(req.body?.amount);
  const amountPaise = Math.round(amount * 100);

  if (
    !description ||
    description.length > 200 ||
    !categories.includes(category) ||
    !Number.isFinite(amount) ||
    amountPaise <= 0 ||
    amountPaise > MAX_PAYMENT_PAISE
  ) {
    return res.status(400).json({ error: 'Enter a payment description, valid category, and amount up to ₹100,000.' });
  }

  try {
    const user = await User.findById(req.user.uid).select('firstName lastName email razorpayPayments');
    if (!user) return res.status(404).json({ error: 'User profile not found.' });

    const reference = `RZP-${Date.now()}-${randomBytes(6).toString('hex')}`;
    const client = getRazorpayClient();
    const paymentLink = await client.paymentLink.create({
      upi_link: true,
      amount: amountPaise,
      currency: 'INR',
      accept_partial: false,
      reference_id: reference,
      description,
      customer: {
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
      },
      notify: { sms: false, email: false },
      reminder_enable: false,
      notes: { user_id: String(user._id), expense_category: category },
    });

    if (!paymentLink.id || !paymentLink.short_url) {
      console.error('Razorpay returned a payment link without a checkout URL.');
      return res.status(502).json({ error: 'Razorpay could not create a checkout link. Please try again.' });
    }

    user.razorpayPayments.unshift({
      reference,
      paymentLinkId: paymentLink.id,
      shortUrl: paymentLink.short_url,
      title: description,
      category,
      amountPaise,
      status: paymentLink.status || 'created',
      createdAt: new Date(),
    });
    await user.save();

    return res.status(201).json({ payment: serializePayment(user.razorpayPayments[0]) });
  } catch (error) {
    if (error.status === 503) {
      return res.status(503).json({ error: error.message });
    }
    console.error('Unable to create Razorpay payment link:', error.message);
    return res.status(502).json({ error: 'Unable to start checkout right now. Please try again.' });
  }
}

async function verifyPayment(req, res) {
  const reference = typeof req.body?.reference === 'string' ? req.body.reference.trim() : '';
  if (!/^RZP-[A-Za-z0-9-]{1,60}$/.test(reference)) {
    return res.status(400).json({ error: 'Enter a valid payment reference.' });
  }

  try {
    const user = await User.findById(req.user.uid).select('razorpayPayments');
    if (!user) return res.status(404).json({ error: 'User profile not found.' });
    const payment = user.razorpayPayments.find((entry) => entry.reference === reference);
    if (!payment) return res.status(404).json({ error: 'Payment not found.' });
    if (payment.status === 'paid') return res.json({ payment: serializePayment(payment) });

    const client = getRazorpayClient();
    const gatewayPayment = await client.paymentLink.fetch(payment.paymentLinkId);
    if (
      gatewayPayment.reference_id !== payment.reference ||
      Number(gatewayPayment.amount) !== payment.amountPaise
    ) {
      console.error('Razorpay payment link did not match its saved payment record.');
      return res.status(502).json({ error: 'Unable to verify this payment. Please contact support.' });
    }

    if (
      gatewayPayment.status === 'paid' &&
      Number(gatewayPayment.amount_paid) === payment.amountPaise
    ) {
      await savePaidPayment(req.user.uid, payment, gatewayPayment);
    } else {
      await User.updateOne(
        {
          _id: req.user.uid,
          razorpayPayments: { $elemMatch: { reference, status: { $ne: 'paid' } } },
        },
        { $set: { 'razorpayPayments.$.status': gatewayPayment.status || 'created' } }
      );
    }

    const refreshedUser = await User.findById(req.user.uid).select('razorpayPayments');
    const refreshedPayment = refreshedUser?.razorpayPayments.find(
      (entry) => entry.reference === reference
    );
    if (!refreshedPayment) return res.status(404).json({ error: 'Payment not found.' });
    return res.json({ payment: serializePayment(refreshedPayment) });
  } catch (error) {
    if (error.status === 503) {
      return res.status(503).json({ error: error.message });
    }
    console.error('Unable to verify Razorpay payment:', error.message);
    return res.status(502).json({ error: 'Unable to verify payment status right now. Please try again.' });
  }
}

async function handleRazorpayWebhook(req, res) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.get('x-razorpay-signature');
  if (!webhookSecret) {
    return res.status(503).json({ error: 'Razorpay webhooks are not configured on the server.' });
  }
  if (
    !Buffer.isBuffer(req.body) ||
    typeof signature !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    return res.status(400).json({ error: 'Invalid Razorpay webhook request.' });
  }

  const expectedSignature = createHmac('sha256', webhookSecret).update(req.body).digest();
  const receivedSignature = Buffer.from(signature, 'hex');
  if (
    expectedSignature.length !== receivedSignature.length ||
    !timingSafeEqual(expectedSignature, receivedSignature)
  ) {
    return res.status(401).json({ error: 'Invalid Razorpay webhook signature.' });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid Razorpay webhook payload.' });
  }

  try {
    if (event.event !== 'payment_link.paid') return res.json({ received: true });

    const linkEntity = event.payload?.payment_link?.entity;
    if (!linkEntity?.id || !linkEntity.reference_id) {
      return res.status(400).json({ error: 'Razorpay webhook is missing payment link details.' });
    }

    const user = await User.findOne({
      razorpayPayments: {
        $elemMatch: {
          reference: linkEntity.reference_id,
          paymentLinkId: linkEntity.id,
        },
      },
    }).select('razorpayPayments');
    const payment = user?.razorpayPayments.find(
      (entry) =>
        entry.reference === linkEntity.reference_id &&
        entry.paymentLinkId === linkEntity.id
    );
    if (!user || !payment) return res.json({ received: true });

    const gatewayPayment = await getRazorpayClient().paymentLink.fetch(payment.paymentLinkId);
    if (
      gatewayPayment.reference_id !== payment.reference ||
      Number(gatewayPayment.amount) !== payment.amountPaise ||
      gatewayPayment.status !== 'paid' ||
      Number(gatewayPayment.amount_paid) !== payment.amountPaise
    ) {
      console.error('Razorpay webhook payment did not match its saved payment record.');
      return res.status(409).json({ error: 'Razorpay payment could not be verified.' });
    }

    await savePaidPayment(String(user._id), payment, gatewayPayment);
    return res.json({ received: true });
  } catch (error) {
    console.error('Unable to process Razorpay webhook:', error.message);
    return res.status(500).json({ error: 'Unable to process Razorpay webhook.' });
  }
}

module.exports = {
  createPaymentLink,
  getPaymentHistory,
  handleRazorpayWebhook,
  verifyPayment,
};
