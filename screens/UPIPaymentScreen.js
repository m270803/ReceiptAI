import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { requestApi } from '../utils/api';

const CATEGORIES = ['Food', 'Rent', 'Travel', 'Shopping', 'Utilities', 'Other'];
const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function paymentStatusLabel(status) {
  if (status === 'paid') return 'Paid';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'expired') return 'Expired';
  return 'Awaiting payment';
}

export default function UPIPaymentScreen({ navigation }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [checkingReference, setCheckingReference] = useState('');
  const [activePaymentReference, setActivePaymentReference] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const verificationInProgress = useRef(false);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const history = await requestApi('/api/payments/razorpay', undefined, 'GET');
      setPayments(history);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load payment history.');
    } finally {
      setIsLoading(false);
    }
  }, [activePaymentReference]);

  const verifyPayment = useCallback(async (reference) => {
    if (!reference || verificationInProgress.current) return;
    verificationInProgress.current = true;
    setCheckingReference(reference);
    setErrorMessage('');
    try {
      const result = await requestApi('/api/payments/razorpay/verify', { reference });
      setPayments((previous) => [
        result.payment,
        ...previous.filter((payment) => payment.reference !== reference),
      ]);
      if (result.payment.status === 'paid' && activePaymentReference === reference) {
        setActivePaymentReference('');
        setDescription('');
        setAmount('');
      }
    } catch (error) {
      setErrorMessage(error.message || 'Unable to verify payment status.');
    } finally {
      verificationInProgress.current = false;
      setCheckingReference('');
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const pendingPayment = payments.find((payment) => payment.status !== 'paid');
      if (pendingPayment) verifyPayment(pendingPayment.reference);
    });
    return () => subscription.remove();
  }, [payments, verifyPayment]);

  const startPayment = async () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 100000) {
      setErrorMessage('Enter an amount greater than ₹0 and no more than ₹100,000.');
      return;
    }
    setIsCreating(true);
    setErrorMessage('');
    try {
      const result = await requestApi('/api/payments/razorpay/create', {
        description: description.trim() || 'UPI payment',
        category,
        amount: numericAmount,
      });
      setPayments((previous) => [
        result.payment,
        ...previous.filter((payment) => payment.reference !== result.payment.reference),
      ]);
      setActivePaymentReference(result.payment.reference);
      await Linking.openURL(result.payment.shortUrl);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to start Razorpay checkout.');
    } finally {
      setIsCreating(false);
    }
  };

  const continuePayment = async (payment) => {
    try {
      await Linking.openURL(payment.shortUrl);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to open the Razorpay checkout link.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={21} color="#1c2b48" />
          </TouchableOpacity>
          <View>
            <Text style={styles.eyebrow}>RAZORPAY CHECKOUT</Text>
            <Text style={styles.title}>Make a payment</Text>
          </View>
        </View>

        <View style={styles.notice}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#4775d1" />
          <Text style={styles.noticeText}>
            Pay securely through Razorpay UPI checkout. Payment goes to the connected business
            account, not to an arbitrary UPI ID.
          </Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Payment details</Text>
          <Text style={styles.label}>DESCRIPTION</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="What is this payment for?"
            maxLength={200}
          />

          <Text style={styles.label}>AMOUNT (₹)</Text>
          <TextInput
            style={[styles.input, styles.amountInput]}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>EXPENSE CATEGORY</Text>
          <View style={styles.categories}>
            {CATEGORIES.map((item) => (
              <TouchableOpacity
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: category === item }}
                style={[styles.categoryChip, category === item && styles.selectedCategory]}
                onPress={() => setCategory(item)}
              >
                <Text style={[styles.categoryText, category === item && styles.selectedCategoryText]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={17} color="#b42318" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.payButton, (isCreating || isLoading) && styles.disabledButton]}
            onPress={startPayment}
            disabled={isCreating || isLoading}
          >
            {isCreating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="lock-closed-outline" size={17} color="#fff" />
                <Text style={styles.payButtonText}>Continue to secure checkout</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <View>
              <Text style={styles.cardTitle}>Transactions</Text>
              <Text style={styles.cardSubtitle}>Verified payments are also saved in Expenses</Text>
            </View>
            <Ionicons name="time-outline" size={22} color="#8290a3" />
          </View>
          {isLoading ? (
            <ActivityIndicator style={styles.historyLoading} color="#4775d1" />
          ) : payments.length ? (
            payments.slice(0, 20).map((payment) => (
              <View key={payment.reference} style={styles.paymentRow}>
                <View style={[styles.paymentIcon, payment.status === 'paid' && styles.paidIcon]}>
                  <Ionicons
                    name={payment.status === 'paid' ? 'checkmark' : 'card-outline'}
                    size={18}
                    color={payment.status === 'paid' ? '#087443' : '#4775d1'}
                  />
                </View>
                <View style={styles.paymentDetails}>
                  <Text style={styles.paymentName} numberOfLines={1}>
                    {payment.title}
                  </Text>
                  <Text style={styles.paymentMeta}>
                    {paymentStatusLabel(payment.status)} · {new Date(payment.createdAt).toLocaleDateString()}
                  </Text>
                  {payment.status !== 'paid' && payment.shortUrl ? (
                    <View style={styles.pendingActions}>
                      <TouchableOpacity onPress={() => continuePayment(payment)}>
                        <Text style={styles.actionLink}>Open checkout</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => verifyPayment(payment.reference)}
                        disabled={checkingReference === payment.reference}
                      >
                        <Text style={styles.actionLink}>
                          {checkingReference === payment.reference ? 'Checking…' : 'Check status'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyHistory}>No transactions yet.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f7fb' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#eaf0fb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  eyebrow: { color: '#4775d1', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#1c2b48', fontSize: 22, fontWeight: '800', marginTop: 2 },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#eaf0fb',
    borderRadius: 14,
    padding: 13,
    marginBottom: 16,
  },
  noticeText: { flex: 1, color: '#344563', fontSize: 12, lineHeight: 18, marginLeft: 9 },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 17,
    borderWidth: 1,
    borderColor: '#edf0f5',
    elevation: 2,
  },
  cardTitle: { color: '#1c2b48', fontSize: 16, fontWeight: '800' },
  cardSubtitle: { color: '#8290a3', fontSize: 12, marginTop: 4 },
  label: { color: '#728099', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#e1e7f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fbfcfe',
    color: '#1c2b48',
    fontSize: 14,
  },
  amountInput: { fontSize: 19, fontWeight: '700' },
  categories: { flexDirection: 'row', flexWrap: 'wrap' },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dce3ed',
    marginRight: 7,
    marginBottom: 7,
  },
  selectedCategory: { backgroundColor: '#1c2b48', borderColor: '#1c2b48' },
  categoryText: { color: '#52627a', fontSize: 12, fontWeight: '600' },
  selectedCategoryText: { color: '#fff' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#fff1f0',
  },
  errorText: { flex: 1, color: '#b42318', fontSize: 12, marginLeft: 6 },
  payButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4775d1',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 18,
  },
  payButtonText: { color: '#fff', fontSize: 14, fontWeight: '800', marginLeft: 8 },
  disabledButton: { opacity: 0.6 },
  historySection: { marginTop: 24 },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyLoading: { marginTop: 24 },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
  },
  paymentIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#eaf0fb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  paidIcon: { backgroundColor: '#e7f6ed' },
  paymentDetails: { flex: 1 },
  paymentName: { color: '#1c2b48', fontSize: 13, fontWeight: '700' },
  paymentMeta: { color: '#8290a3', fontSize: 11, marginTop: 3 },
  pendingActions: { flexDirection: 'row', marginTop: 7 },
  actionLink: { color: '#4775d1', fontSize: 11, fontWeight: '700', marginRight: 14 },
  paymentAmount: { color: '#1c2b48', fontSize: 13, fontWeight: '700', marginLeft: 8 },
  emptyHistory: { color: '#8290a3', fontSize: 13, textAlign: 'center', paddingVertical: 22 },
});
