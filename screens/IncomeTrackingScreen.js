import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { requestApi } from '../utils/api';

export default function IncomeTrackingScreen() {
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [incomeList, setIncomeList] = useState([]);
  const [expenses, setExpenses] = useState([]);

  const navigation = useNavigation();

  /* ---------------- SAVE INCOME ---------------- */
  const saveIncome = async () => {
    if (!source || !amount) return Alert.alert('Fill all fields');

    const newIncome = {
      source,
      amount: parseFloat(amount),
      date: new Date().toISOString(),
    };

    try {
      await requestApi('/api/finance/incomes', newIncome);
      setSource('');
      setAmount('');
      await fetchIncomes();
    } catch (error) {
      Alert.alert('Unable to save income', error.message);
    }
  };

  /* ---------------- FETCH INCOMES ---------------- */
  const fetchIncomes = async () => {
    setIncomeList(await requestApi('/api/finance/incomes', undefined, 'GET'));
  };

  /* ---------------- FETCH EXPENSES (FIXED PATH) ---------------- */
  const fetchExpenses = async () => {
    // FIXED: Correct path for Expense Tracker
    setExpenses(await requestApi('/api/finance/expenses', undefined, 'GET'));
  };

  /* ---------------- DELETE INCOME ---------------- */
  const deleteIncome = async (id) => {
    try {
      await requestApi(`/api/finance/incomes/${id}`, undefined, 'DELETE');
      await fetchIncomes();
    } catch (error) {
      Alert.alert('Unable to delete income', error.message);
    }
  };

  /* ---------------- EDIT INCOME ---------------- */
  const editIncome = async (item) => {
    setSource(item.source);
    setAmount(String(item.amount));
    await deleteIncome(item.id);
  };

  useEffect(() => {
    Promise.all([fetchIncomes(), fetchExpenses()]).catch((error) =>
      Alert.alert('Unable to load finance data', error.message)
    );
  }, []);

  /* ---------------- SUMMARY CALCULATIONS ---------------- */
  const totalIncome = incomeList.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netSavings = totalIncome - totalExpenses;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Income Tracker</Text>
      <Text style={styles.heading}>Add Income</Text>

      {/* INPUT CARD */}
      <View style={styles.card}>
        <Text style={styles.label}>Source</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Salary"
          value={source}
          onChangeText={setSource}
        />

        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 50000"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />

        <TouchableOpacity style={styles.btn} onPress={saveIncome}>
          <Text style={styles.btnText}>Add Income</Text>
        </TouchableOpacity>
      </View>

      {/* SUMMARY BOX */}
      <View style={styles.summaryBox}>
        <Text>Total Income: ₹{totalIncome}</Text>
        <Text>Total Expenses: ₹{totalExpenses}</Text>
        <Text style={{ fontWeight: 'bold' }}>Net Savings: ₹{netSavings}</Text>
      </View>

      <Text style={styles.heading}>Income List</Text>

      {/* LIST */}
      <FlatList
        data={incomeList}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>{item.source} - ₹{item.amount}</Text>

            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <TouchableOpacity onPress={() => editIncome(item)} style={{ marginRight: 20 }}>
                <Text style={{ color: 'blue' }}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => deleteIncome(item.id)}>
                <Text style={{ color: 'red' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* GO TO EXPENSES */}
      <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Expenses' })}>
        <Text style={{ color: '#007AFF', textAlign: 'center', marginTop: 10, marginBottom: 50 }}>
          Go to Expense Tracker
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* -------------------------- STYLES -------------------------- */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8f9fa' },
  heading: { fontSize: 22, fontWeight: 'bold', marginTop: 14, marginBottom: 14 },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 15 },
  label: { marginTop: 10, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginTop: 5,
  },
  btn: {
    backgroundColor: '#1c2b48',
    padding: 12,
    borderRadius: 6,
    marginTop: 15,
  },
  btnText: { color: '#fff', textAlign: 'center', fontWeight: 'bold' },
  summaryBox: {
    padding: 15,
    backgroundColor: '#e0f7fa',
    borderRadius: 10,
    marginVertical: 10,
  },
});