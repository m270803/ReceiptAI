import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from '@react-navigation/native';
import { requestApi } from '../utils/api';

const UPI_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}@[A-Za-z0-9][A-Za-z0-9.-]{1,99}$/;
const formatCurrency = (amount) =>
  `₹${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function parseUpiQr(payload) {
  const value = typeof payload === 'string' ? payload.trim() : '';
  if (UPI_ID_PATTERN.test(value)) return { upiId: value };

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol.toLowerCase() !== 'upi:') return null;
  const upiId = url.searchParams.get('pa')?.trim() || '';
  if (!UPI_ID_PATTERN.test(upiId)) return null;

  const currency = url.searchParams.get('cu');
  if (currency && currency.toUpperCase() !== 'INR') return null;

  const rawAmount = url.searchParams.get('am');
  const amount = rawAmount && Number.isFinite(Number(rawAmount)) ? String(Number(rawAmount)) : '';
  return {
    upiId,
    payeeName: url.searchParams.get('pn') || '',
    amount,
  };
}

export default function MockPaymentScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [balance, setBalance] = useState(null);
  const [payments, setPayments] = useState([]);
  const [upiId, setUpiId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [completedPayment, setCompletedPayment] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const loadWallet = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const wallet = await requestApi('/api/payments/mock', undefined, 'GET');
      setBalance(wallet.balance);
      setPayments(wallet.payments || []);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load the demo wallet.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWallet();
    }, [loadWallet])
  );

  const openScanner = async () => {
    setErrorMessage('');
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setErrorMessage('Allow camera access to scan a UPI QR code.');
        return;
      }
    }
    setHasScanned(false);
    setIsScanning(true);
  };

  const handleQrScanned = ({ data }) => {
    if (hasScanned) return;
    setHasScanned(true);
    setIsScanning(false);
    const recipient = parseUpiQr(data);
    if (!recipient) {
      setErrorMessage('This QR code is not a supported INR UPI payment code.');
      return;
    }
    setUpiId(recipient.upiId);
    setPayeeName(recipient.payeeName || '');
    setAmount(recipient.amount || '');
    setErrorMessage('');
  };

  const reviewPayment = () => {
    setErrorMessage('');
    const numericAmount = Number(amount);
    if (!UPI_ID_PATTERN.test(upiId.trim())) {
      setErrorMessage('Enter a valid UPI ID, for example name@bank.');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 100000) {
      setErrorMessage('Enter an amount greater than ₹0 and no more than ₹100,000.');
      return;
    }
    setShowConfirmation(true);
  };

  const makePayment = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const result = await requestApi('/api/payments/mock', {
        upiId: upiId.trim(),
        payeeName: payeeName.trim(),
        amount: Number(amount),
      });
      setBalance(result.balance);
      setPayments((previous) => [result.payment, ...previous].slice(0, 100));
      setShowConfirmation(false);
      setCompletedPayment(result.payment);
      setAmount('');
    } catch (error) {
      setErrorMessage(error.message || 'The simulated payment could not be completed.');
      setShowConfirmation(false);
      if (error.status === 400) loadWallet();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
              <Text style={styles.eyebrow}>UPI PAYMENTS</Text>
              <Text style={styles.title}>Pay someone</Text>
            </View>
          </View>

          <View style={styles.walletCard}>
            <View style={styles.walletTopRow}>
              <View>
                <Text style={styles.walletLabel}>DEMO WALLET</Text>
                <Text style={styles.balance}>
                  {isLoading ? 'Loading…' : formatCurrency(balance)}
                </Text>
              </View>
              <View style={styles.walletIcon}>
                <Ionicons name="wallet-outline" size={23} color="#fff" />
              </View>
            </View>
            <View style={styles.demoNotice}>
              <Ionicons name="information-circle-outline" size={16} color="#dce8ff" />
              <Text style={styles.demoNoticeText}>
                Demo funds only. No real money is transferred.
              </Text>
            </View>
          </View>

          {isScanning ? (
            <View style={styles.cameraCard}>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleQrScanned}
              />
              <TouchableOpacity style={styles.cancelScan} onPress={() => setIsScanning(false)}>
                <Ionicons name="close" size={20} color="#1c2b48" />
                <Text style={styles.cancelScanText}>Cancel scan</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formCard}>
              <View style={styles.formHeadingRow}>
                <View>
                  <Text style={styles.cardTitle}>Payment details</Text>
                  <Text style={styles.cardSubtitle}>Scan a QR or enter a UPI ID</Text>
                </View>
                <Ionicons name="shield-checkmark-outline" size={23} color="#4775d1" />
              </View>

              <TouchableOpacity style={styles.scanButton} onPress={openScanner}>
                <Ionicons name="qr-code-outline" size={20} color="#fff" />
                <Text style={styles.scanButtonText}>Scan UPI QR</Text>
              </TouchableOpacity>

              <View style={styles.orDivider}>
                <View style={styles.dividerLine} />
                <Text style={styles.orText}>OR ENTER DETAILS</Text>
                <View style={styles.dividerLine} />
              </View>

              <Text style={styles.inputLabel}>UPI ID</Text>
              <TextInput
                style={styles.input}
                value={upiId}
                onChangeText={setUpiId}
                placeholder="name@bank"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />

              <Text style={styles.inputLabel}>RECIPIENT NAME · OPTIONAL</Text>
              <TextInput
                style={styles.input}
                value={payeeName}
                onChangeText={setPayeeName}
                placeholder="Name shown on the payment"
                maxLength={120}
              />

              <Text style={styles.inputLabel}>AMOUNT (₹)</Text>
              <TextInput
                style={[styles.input, styles.amountInput]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />

              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={17} color="#b42318" />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.payButton, (isLoading || isSubmitting) && styles.disabledButton]}
                onPress={reviewPayment}
                disabled={isLoading || isSubmitting}
              >
                <Text style={styles.payButtonText}>Review payment</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <View>
                <Text style={styles.cardTitle}>Recent payments</Text>
                <Text style={styles.cardSubtitle}>Your simulated transactions</Text>
              </View>
              <Ionicons name="time-outline" size={22} color="#8290a3" />
            </View>

            {isLoading ? (
              <ActivityIndicator style={styles.historyLoading} color="#4775d1" />
            ) : payments.length ? (
              payments.slice(0, 8).map((payment) => (
                <View key={payment.id || payment.reference} style={styles.paymentRow}>
                  <View style={styles.paymentIcon}>
                    <Ionicons name="arrow-up-outline" size={18} color="#4775d1" />
                  </View>
                  <View style={styles.paymentDetails}>
                    <Text style={styles.paymentName} numberOfLines={1}>
                      {payment.payeeName || payment.upiId}
                    </Text>
                    <Text style={styles.paymentMeta}>
                      {payment.upiId} · {payment.status === 'SIMULATED' ? 'Simulated · ' : ''}
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.paymentAmount}>−{formatCurrency(payment.amount)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyHistory}>No demo payments yet.</Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        transparent
        visible={showConfirmation}
        animationType="fade"
        onRequestClose={() => setShowConfirmation(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="arrow-up" size={22} color="#4775d1" />
            </View>
            <Text style={styles.modalTitle}>Confirm demo payment</Text>
            <Text style={styles.modalAmount}>{formatCurrency(amount)}</Text>
            <Text style={styles.modalRecipient}>{payeeName.trim() || upiId.trim()}</Text>
            <Text style={styles.modalDisclaimer}>
              This only deducts demo funds in ReceiptAI. It will not send money through UPI.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowConfirmation(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, isSubmitting && styles.disabledButton]}
                onPress={makePayment}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Simulate payment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={Boolean(completedPayment)}
        animationType="fade"
        onRequestClose={() => setCompletedPayment(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.modalIcon, styles.successIcon]}>
              <Ionicons name="checkmark" size={24} color="#087443" />
            </View>
            <Text style={styles.modalTitle}>Demo payment complete</Text>
            <Text style={styles.modalAmount}>
              {completedPayment ? formatCurrency(completedPayment.amount) : ''}
            </Text>
            <Text style={styles.modalRecipient}>
              {completedPayment?.payeeName || completedPayment?.upiId}
            </Text>
            <Text style={styles.referenceText}>
              Reference: {completedPayment?.reference}
            </Text>
            <Text style={styles.modalDisclaimer}>
              This was a simulation. No real money was transferred.
            </Text>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => setCompletedPayment(null)}
            >
              <Text style={styles.confirmButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f7fb' },
  flex: { flex: 1 },
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
  walletCard: {
    backgroundColor: '#1c2b48',
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#14213a',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  walletTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  walletLabel: { color: '#a9bddf', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  balance: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 7 },
  walletIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
    marginTop: 17,
    paddingTop: 12,
  },
  demoNoticeText: { color: '#dce8ff', fontSize: 12, marginLeft: 7 },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 17,
    borderWidth: 1,
    borderColor: '#edf0f5',
    shadowColor: '#14213a',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  formHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#1c2b48', fontSize: 16, fontWeight: '800' },
  cardSubtitle: { color: '#8290a3', fontSize: 12, marginTop: 4 },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c2b48',
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 17,
  },
  scanButtonText: { color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 8 },
  orDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 17 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#edf0f5' },
  orText: { color: '#94a3b8', fontSize: 9, fontWeight: '800', letterSpacing: 1, marginHorizontal: 10 },
  inputLabel: { color: '#728099', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6, marginTop: 10 },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4775d1',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 18,
  },
  payButtonText: { color: '#fff', fontSize: 14, fontWeight: '800', marginRight: 8 },
  disabledButton: { opacity: 0.6 },
  cameraCard: {
    height: 340,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#101828',
    marginBottom: 16,
  },
  camera: { flex: 1 },
  cancelScan: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  cancelScanText: { color: '#1c2b48', fontWeight: '700', marginLeft: 5 },
  historySection: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 17,
    borderWidth: 1,
    borderColor: '#edf0f5',
    marginTop: 16,
  },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  historyLoading: { marginVertical: 20 },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f2f6',
    paddingVertical: 12,
  },
  paymentIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#edf3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  paymentDetails: { flex: 1, marginRight: 8 },
  paymentName: { color: '#1c2b48', fontSize: 13, fontWeight: '700' },
  paymentMeta: { color: '#8290a3', fontSize: 10, marginTop: 3 },
  paymentAmount: { color: '#1c2b48', fontSize: 13, fontWeight: '800' },
  emptyHistory: { color: '#8290a3', fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(11, 20, 36, 0.55)',
    padding: 22,
  },
  modalCard: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#edf3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successIcon: { backgroundColor: '#e8f7ef' },
  modalTitle: { color: '#1c2b48', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  modalAmount: { color: '#1c2b48', fontSize: 26, fontWeight: '800', marginTop: 12 },
  modalRecipient: { color: '#64748b', fontSize: 13, marginTop: 4, textAlign: 'center' },
  modalDisclaimer: {
    color: '#728099',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 19,
  },
  modalActions: { flexDirection: 'row', width: '100%' },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f1f4f8',
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: { color: '#344054', fontSize: 13, fontWeight: '700' },
  confirmButton: {
    flex: 1,
    backgroundColor: '#4775d1',
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  referenceText: { color: '#8290a3', fontSize: 11, marginTop: 12, textAlign: 'center' },
});
