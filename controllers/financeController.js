const { User } = require('../models/user');

const resourceFields = {
  expenses: 'expenses',
  incomes: 'incomes',
  budgets: 'budgets',
  'savings-goals': 'savingsGoals',
};
const categories = ['Food', 'Rent', 'Travel', 'Shopping', 'Utilities', 'Other'];

function parseEntry(resource, body) {
  const amount = Number(body?.amount);

  if (resource === 'expenses') {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const category = typeof body.category === 'string' ? body.category : '';
    const date = new Date(body.date);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !title ||
      title.length > 200 ||
      !categories.includes(category) ||
      Number.isNaN(date.getTime())
    ) {
      return null;
    }
    const items = Array.isArray(body.items)
      ? body.items
          .filter((item) => item && typeof item.name === 'string')
          .slice(0, 100)
          .map((item) => ({
            name: item.name.trim().slice(0, 200),
            qty: String(item.qty ?? '').slice(0, 40),
            rate: String(item.rate ?? '').slice(0, 40),
            amount: String(item.amount ?? '').slice(0, 40),
          }))
          .filter((item) => item.name)
      : [];
    return { title, amount, category, date, items, createdAt: new Date() };
  }
  if (resource === 'incomes') {
    const source = typeof body.source === 'string' ? body.source.trim() : '';
    const date = body.date ? new Date(body.date) : new Date();
    if (!Number.isFinite(amount) || amount <= 0 || !source || source.length > 200 || Number.isNaN(date.getTime())) return null;
    return { source, amount, date };
  }
  if (resource === 'budgets') {
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    if (!Number.isFinite(amount) || amount <= 0 || !category || category.length > 80) return null;
    return { category, amount, createdAt: new Date() };
  }
  if (resource === 'savings-goals') {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const target = Number(body.target);
    const saved = Number(body.saved);
    if (
      !title ||
      title.length > 200 ||
      !Number.isFinite(target) ||
      target <= 0 ||
      !Number.isFinite(saved) ||
      saved < 0
    ) {
      return null;
    }
    return { title, target, saved, createdAt: new Date() };
  }
  return null;
}

function serializeEntry(entry) {
  const { _id, ...data } = entry.toObject();
  return { id: String(_id), ...data };
}

async function getUserAndField(req, res) {
  const field = resourceFields[req.params.resource];
  if (!field) {
    res.status(404).json({ error: 'Finance resource not found.' });
    return null;
  }
  const user = await User.findById(req.user.uid).select(field);
  if (!user) {
    res.status(404).json({ error: 'User profile not found.' });
    return null;
  }
  return { field, user };
}

async function listEntries(req, res) {
  try {
    const result = await getUserAndField(req, res);
    if (!result) return;
    return res.json(result.user[result.field].map(serializeEntry));
  } catch (error) {
    console.error('Unable to load finance entries:', error.message);
    return res.status(500).json({ error: 'Unable to load this finance data right now.' });
  }
}

async function createEntry(req, res) {
  try {
    const result = await getUserAndField(req, res);
    if (!result) return;
    const entry = parseEntry(req.params.resource, req.body || {});
    if (!entry) return res.status(400).json({ error: 'Enter valid finance entry details.' });
    result.user[result.field].push(entry);
    await result.user.save();
    const entries = result.user[result.field];
    return res.status(201).json(serializeEntry(entries[entries.length - 1]));
  } catch (error) {
    console.error('Unable to create finance entry:', error.message);
    return res.status(500).json({ error: 'Unable to save this finance entry right now.' });
  }
}

async function updateEntry(req, res) {
  try {
    const result = await getUserAndField(req, res);
    if (!result) return;
    const entry = result.user[result.field].id(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Finance entry not found.' });
    const values = parseEntry(req.params.resource, req.body || {});
    if (!values) return res.status(400).json({ error: 'Enter valid finance entry details.' });
    delete values.createdAt;
    entry.set(values);
    await result.user.save();
    return res.json(serializeEntry(entry));
  } catch (error) {
    console.error('Unable to update finance entry:', error.message);
    return res.status(500).json({ error: 'Unable to update this finance entry right now.' });
  }
}

async function deleteEntry(req, res) {
  try {
    const result = await getUserAndField(req, res);
    if (!result) return;
    const entry = result.user[result.field].id(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Finance entry not found.' });
    entry.deleteOne();
    await result.user.save();
    return res.json({ message: 'Finance entry deleted.' });
  } catch (error) {
    console.error('Unable to delete finance entry:', error.message);
    return res.status(500).json({ error: 'Unable to delete this finance entry right now.' });
  }
}

module.exports = { createEntry, deleteEntry, listEntries, updateEntry };
