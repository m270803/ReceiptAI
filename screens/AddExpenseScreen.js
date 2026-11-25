import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Platform,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { requestApi } from '../utils/api';

const CATEGORIES = ['All', 'Food', 'Rent', 'Travel', 'Shopping', 'Utilities', 'Other'];
const MONTHLY_LIMIT = 40000;

const parseLocalDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return new Date(value);
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return new Date(Number.NaN);
  }
  return date;
};

export default function AddExpenseScreen({ navigation, route }) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(new Date());
  const [receiptItems, setReceiptItems] = useState([]);
  const [showDate, setShowDate] = useState(false);
  const [showCat, setShowCat] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [sortNewest, setSortNewest] = useState(true);
  const [searchText, setSearchText] = useState('');

  /* AUTO-FILL FROM ScanReceiptScreen */
  useEffect(() => {
    if (route?.params?.fromScan) {
      const t = route.params.prefillTitle || "";
      const a = route.params.prefillAmount || "";

      setTitle(t);
      setAmount(String(a));
      if (CATEGORIES.includes(route.params.prefillCategory)) {
        setCategory(route.params.prefillCategory);
      }
      if (route.params.prefillDate) {
        const prefilledDate = parseLocalDate(route.params.prefillDate);
        if (!Number.isNaN(prefilledDate.getTime())) setDate(prefilledDate);
      }
      setReceiptItems(Array.isArray(route.params.prefillItems) ? route.params.prefillItems : []);
      setShowForm(true);
      navigation.setParams({ fromScan: false });
    }
  }, [route?.params]);

  /* FILTERS */
  const applyFilters = (list, search = searchText) => {
    let f = [...list];

    if (activeFilter !== 'All') {
      f = f.filter((exp) => exp.category === activeFilter);
    }

    if (search.trim() !== '') {
      f = f.filter((exp) =>
        exp.title.toLowerCase().includes(search.toLowerCase())
      );
    }

    f.sort((a, b) => (sortNewest ? b.date - a.date : a.date - b.date));
    setFilteredExpenses(f);
  };

  /* FETCH EXPENSES */
  const fetchExpenses = async () => {
    const data = await requestApi('/api/finance/expenses', undefined, 'GET');
    const list = data
      .map((expense) => ({ ...expense, date: new Date(expense.date) }))
      .filter(
        (expense) =>
          expense.date.getFullYear() === date.getFullYear() &&
          expense.date.getMonth() === date.getMonth()
      );

    setExpenses(list);
    applyFilters(list);
  };

  useEffect(() => {
    fetchExpenses();
  }, [date.getFullYear(), date.getMonth()]);

  useEffect(() => {
    applyFilters(expenses);
  }, [activeFilter, sortNewest]);

  /* SAVE EXPENSE */
  const saveExpense = async () => {
    if (!title || !amount) return alert('Please fill all fields');
    const expenseData = {
      title,
      amount: parseFloat(amount),
      category,
      date: date.toISOString(),
      createdAt: new Date(),
      ...(receiptItems.length ? { items: receiptItems } : {}),
    };

    try {
      if (editingId) {
        await requestApi(`/api/finance/expenses/${editingId}`, expenseData, 'PUT');
        alert('Expense updated!');
        setEditingId(null);
      } else {
        await requestApi('/api/finance/expenses', expenseData);
        alert('Expense saved!');
      }

      setTitle('');
      setAmount('');
      setCategory('Food');
      setDate(new Date());
      setReceiptItems([]);

      await fetchExpenses();
    } catch (error) {
      Alert.alert('Failed to save expense', error.message);
    }
  };

  /* EDIT */
  const handleEdit = (item) => {
    setTitle(item.title);
    setAmount(item.amount.toString());
    setCategory(item.category);
    setDate(new Date(item.date));
    setReceiptItems(Array.isArray(item.items) ? item.items : []);
    setEditingId(item.id);
    setShowForm(true);
  };

  /* DELETE */
  const handleDelete = async (id) => {
    try {
      await requestApi(`/api/finance/expenses/${id}`, undefined, 'DELETE');
      await fetchExpenses();
    } catch (error) {
      Alert.alert('Delete failed', error.message);
    }
  };

  /* RENDER ITEM */
  const renderItem = ({ item }) => (
    <View style={styles.expenseItem}>
      <View>
        <Text style={styles.expenseTitle}>{item.title} • ₹{item.amount}</Text>
        <Text style={styles.expenseMeta}>
          {item.category} | {item.date.toDateString()}
        </Text>
      </View>

      <View style={styles.actionBtns}>
        {item.paymentProvider === 'razorpay' ? (
          <Ionicons name="lock-closed-outline" size={18} color="#8290a3" />
        ) : (
          <>
            <TouchableOpacity onPress={() => handleEdit(item)}>
              <Ionicons name="pencil" size={20} color="#1c2b48" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ marginLeft: 12 }}>
              <Ionicons name="trash" size={20} color="crimson" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  /* PDF */
  const buildExpensesHtml = () => {
    const rows = filteredExpenses
      .map(
        (e, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${e.title}</td>
          <td>₹${e.amount}</td>
          <td>${e.category}</td>
          <td>${e.date.toDateString()}</td>
        </tr>`
      )
      .join('');

    return `
      <html>
        <body>
          <h1 style="text-align:center;">Monthly Expenses</h1>
          <table border="1" width="100%" style="border-collapse:collapse;">
            ${rows}
          </table>
        </body>
      </html>`;
  };

  const downloadMonthlyPdf = async () => {
    if (!filteredExpenses.length) return alert('No expenses to export.');

    const html = buildExpensesHtml();
    const { uri } = await Print.printToFileAsync({ html });
    await shareAsync(uri, { mimeType: 'application/pdf' });
  };

  /* ------------------------------ UI ------------------------------ */
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Expense Tracker</Text>

      {/* ADD HEADER */}
      <View style={styles.addHeaderRow}>
        <Text style={styles.heading}>Add Expense</Text>
        <TouchableOpacity onPress={() => setShowForm((p) => !p)}>
          <Ionicons
            name={showForm ? 'remove-circle-outline' : 'add-circle-outline'}
            size={26}
            color="#1c2b48"
          />
        </TouchableOpacity>
      </View>

      {/* FORM */}
      {showForm && (
        <View style={styles.card}>
          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} />

          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Category</Text>
          <TouchableOpacity style={styles.select} onPress={() => setShowCat(true)}>
            <Text>{category}</Text>
            <Ionicons name="chevron-down" size={20} />
          </TouchableOpacity>

          <Text style={styles.label}>Date</Text>
          <TouchableOpacity style={styles.select} onPress={() => setShowDate(true)}>
            <Text>{date.toDateString()}</Text>
            <Ionicons name="calendar" size={20} />
          </TouchableOpacity>

          {receiptItems.length > 0 && (
            <View style={styles.receiptItems}>
              <Text style={styles.label}>Receipt items</Text>
              {receiptItems.map((item, index) => (
                <View key={`${item.name}-${index}`} style={styles.receiptItem}>
                  <Text style={styles.receiptItemName}>{item.name}</Text>
                  <Text style={styles.receiptItemAmount}>
                    {item.qty ? `${item.qty} × ` : ''}₹{item.amount || item.rate || '—'}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.btn} onPress={saveExpense}>
            <Text style={styles.btnText}>{editingId ? 'Update' : 'Save'} Expense</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CATEGORY MODAL */}
      <Modal visible={showCat} transparent animationType="fade">
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <View style={{
            width: '80%',
            backgroundColor: '#fff',
            borderRadius: 12,
            padding: 20
          }}>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 10 }}>
              Select Category
            </Text>

            {CATEGORIES.filter(c => c !== 'All').map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => {
                  setCategory(cat);
                  setShowCat(false);
                }}
                style={{ paddingVertical: 10 }}
              >
                <Text style={{ fontSize: 15 }}>{cat}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              onPress={() => setShowCat(false)}
              style={{ marginTop: 10, alignSelf: 'flex-end' }}
            >
              <Text style={{ color: 'crimson' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* DATE PICKER */}
      {showDate && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDate(false);
            if (selectedDate) setDate(selectedDate);
          }}
        />
      )}

      {/* THIS MONTH'S EXPENSES */}
      <Text style={[styles.heading, { fontSize: 20, marginTop: 24 }]}>
        This Month’s Expenses
      </Text>

      {/* SEARCH BAR */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#1c2b48" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search expenses..."
          value={searchText}
          onChangeText={(t) => {
            setSearchText(t);
            applyFilters(expenses, t);
          }}
        />
      </View>

      {/* CATEGORY FILTER */}
      <View style={styles.filterRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => setActiveFilter(cat)}
            style={[
              styles.filterBtn,
              activeFilter === cat && styles.filterBtnActive,
            ]}
          >
            <Text style={{ color: activeFilter === cat ? '#fff' : '#1c2b48' }}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* SORTING */}
      <TouchableOpacity
        style={styles.sortLink}
        onPress={() => setSortNewest((prev) => !prev)}
      >
        <Text style={styles.sortTextLink}>
          Sort: {sortNewest ? 'Newest First' : 'Oldest First'}
        </Text>
      </TouchableOpacity>

      {/* LIST */}
      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 40 }}
      />

      <TouchableOpacity onPress={downloadMonthlyPdf}>
        <Text style={styles.link}>Download Monthly Expenses PDF</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Income')}>
        <Text style={[styles.link, { marginBottom: 50 }]}>
          Go to Income Tracker
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* -------------------------- STYLES -------------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f6f8fa' },

  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1c2b48',
  },

  addHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 2,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },

  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1c2b48',
    marginRight: 8,
    marginBottom: 8,
  },
  filterBtnActive: {
    backgroundColor: '#1c2b48',
  },

  sortLink: {
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  sortTextLink: {
    color: '#007AFF',
    fontWeight: '700',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
  },

  label: { fontSize: 14, fontWeight: '600', marginTop: 12 },

  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#f9fafb',
  },

  select: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  receiptItems: {
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e8edf4',
  },
  receiptItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  receiptItemName: { flex: 1, color: '#334155', fontSize: 13 },
  receiptItemAmount: { color: '#64748b', fontSize: 12, marginLeft: 8 },

  btn: {
    backgroundColor: '#1c2b48',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginTop: 12,
    elevation: 2,
  },
  expenseTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c2b48',
  },
  expenseMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  actionBtns: { flexDirection: 'row', alignItems: 'center' },

  link: {
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 10,
  },
});