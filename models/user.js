const mongoose = require('mongoose');

const financeEntrySchema = new mongoose.Schema(
  {},
  { _id: true, strict: false }
);

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    emailVerified: { type: Boolean, default: false },
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
    expenses: { type: [financeEntrySchema], default: [] },
    incomes: { type: [financeEntrySchema], default: [] },
    budgets: { type: [financeEntrySchema], default: [] },
    savingsGoals: { type: [financeEntrySchema], default: [] },
    mockWalletBalancePaise: { type: Number, default: 1000000 },
    mockPayments: { type: [financeEntrySchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

function publicUser(user) {
  if (!user) return null;
  const record = typeof user.toObject === 'function' ? user.toObject() : user;
  return {
    uid: String(record._id),
    firstName: record.firstName,
    lastName: record.lastName,
    email: record.email,
    emailVerified: Boolean(record.emailVerified),
    theme: record.theme || 'auto',
    createdAt: record.createdAt,
  };
}

function toAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

async function getUserProfile(uid) {
  return publicUser(await User.findById(uid));
}

async function getFinancialInsights(uid) {
  const user = await User.findById(uid).select('expenses incomes budgets savingsGoals');
  if (!user) {
    const error = new Error('User profile not found.');
    error.status = 404;
    throw error;
  }

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const currentMonthExpenses = user.expenses.filter((expense) => {
    const date = new Date(expense.date || expense.createdAt);
    return !Number.isNaN(date.getTime()) && date.getMonth() === month && date.getFullYear() === year;
  });
  const currentMonthIncome = user.incomes.filter((income) => {
    const date = new Date(income.date || income.createdAt);
    return !Number.isNaN(date.getTime()) && date.getMonth() === month && date.getFullYear() === year;
  });

  const groupedByCategory = {};
  const dailyTotals = Array(daysInMonth).fill(0);
  let totalExpenses = 0;
  for (const expense of currentMonthExpenses) {
    const date = new Date(expense.date || expense.createdAt);
    const category = expense.category || 'Other';
    const amount = toAmount(expense.amount);
    groupedByCategory[category] = (groupedByCategory[category] || 0) + amount;
    totalExpenses += amount;
    dailyTotals[date.getDate() - 1] += amount;
  }

  const totalIncome = currentMonthIncome.reduce((total, income) => total + toAmount(income.amount), 0);
  const sortedCategories = Object.entries(groupedByCategory).sort(
    (first, second) => second[1] - first[1]
  );
  const pieColors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'];

  return {
    pieData: sortedCategories.map(([name, amount], index) => ({
      name,
      amount,
      color: pieColors[index % pieColors.length],
      legendFontColor: '#333',
      legendFontSize: 13,
    })),
    lineLabels: dailyTotals.map((_, index) => {
      const day = index + 1;
      return [1, 5, 10, 15, 20, 25, daysInMonth].includes(day) ? String(day) : '';
    }),
    lineValues: dailyTotals,
    barLabels: sortedCategories.slice(0, 5).map(([category]) => category),
    barValues: sortedCategories.slice(0, 5).map(([, amount]) => amount),
    totalExpenses,
    totalIncome,
    savings: totalIncome - totalExpenses,
    topCategory: sortedCategories[0]?.[0] || '',
    avgDaily: daysInMonth ? totalExpenses / daysInMonth : 0,
    budgets: user.budgets.map(({ category, amount }) => ({
      category: category || 'Other',
      amount: toAmount(amount),
    })),
    savingsGoals: user.savingsGoals.map(({ title, target, saved }) => ({
      title: typeof title === 'string' ? title : 'Savings goal',
      target: toAmount(target),
      saved: toAmount(saved),
    })),
  };
}

module.exports = { User, getFinancialInsights, getUserProfile, publicUser };
