// ScanReceiptScreen.js
// QR scan and Grok-powered receipt image scanning.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useNavigation } from '@react-navigation/native';
import { requestApi } from '../utils/api';

const categories = ['Food', 'Rent', 'Travel', 'Shopping', 'Utilities', 'Other'];
const currentDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
};

export default function ScanReceiptScreen() {
  const navigation = useNavigation();

  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [scannedOnce, setScannedOnce] = useState(false);

  const [imageUri, setImageUri] = useState(null);
  const [rawData, setRawData] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [receiptDate, setReceiptDate] = useState(currentDate());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  /* ---------------------------------------------------
     Camera Permission
  --------------------------------------------------- */
  useEffect(() => {
    if (!permission) requestPermission();
  }, []);

  const ensureCameraPermission = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert("Camera Permission", "Camera permission is required.");
        return false;
      }
    }
    return true;
  };

  /* ---------------------------------------------------
     QR SCAN
  --------------------------------------------------- */
  const startQrScan = async () => {
    const ok = await ensureCameraPermission();
    if (!ok) return;

    setImageUri(null);
    setRawData('');
    setAmount('');
    setTitle('');
    setCategory('Other');
    setReceiptDate(currentDate());
    setItems([]);
    setScannedOnce(false);
    setIsCameraVisible(true);
  };

  const handleBarcodeScanned = ({ data }) => {
    if (scannedOnce) return;
    setScannedOnce(true);
    setIsCameraVisible(false);
    parseQR(data);
  };

  const parseQR = (text) => {
    setRawData(text);
    setItems([]);

    let t = "Scanned Receipt";
    let a = "";

    try {
      const obj = JSON.parse(text);
      if (obj.title) t = obj.title;
      if (obj.amount) a = String(obj.amount);
      if (typeof obj.date === 'string' && !Number.isNaN(new Date(obj.date).getTime())) {
        setReceiptDate(new Date(obj.date).toISOString().slice(0, 10));
      }
      if (categories.includes(obj.category)) setCategory(obj.category);
      if (Array.isArray(obj.items)) {
        setItems(
          obj.items
            .filter((item) => item && typeof item.name === 'string')
            .slice(0, 100)
            .map((item) => ({
              name: item.name,
              qty: String(item.qty ?? item.quantity ?? ''),
              rate: String(item.rate ?? ''),
              amount: String(item.amount ?? ''),
            }))
        );
      }
    } catch {}

    if (!a) {
      const num = text.match(/(\d+(\.\d+)?)/);
      if (num) a = num[1];
    }

    setTitle(t);
    setAmount(a);
  };

  /* ---------------------------------------------------
     PICK IMAGE → COMPRESS → SEND TO GROK
  --------------------------------------------------- */
  const pickImageFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Gallery access is needed.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: false,
      quality: 1,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      setImageUri(asset.uri);

      setRawData('');
      setTitle('');
      setAmount('');
      setCategory('Other');
      setReceiptDate(currentDate());
      setItems([]);

      // Compress the image before sending it to the authenticated backend.
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!compressed.base64) {
        Alert.alert('Receipt scan failed', 'Could not prepare the selected image.');
        return;
      }

      runGrokReceiptScan(compressed.base64);
    }
  };

  /* ---------------------------------------------------
     GROK RECEIPT SCAN API
  --------------------------------------------------- */
  const runGrokReceiptScan = async (base64) => {
    setLoading(true);
    try {
      const receipt = await requestApi('/api/receipts/scan', {
        imageBase64: base64,
        mimeType: 'image/jpeg',
      });

      setRawData(receipt.rawText || '');
      setTitle(receipt.title || 'Scanned Receipt');
      setAmount(receipt.amount || '');
      setCategory(receipt.category || 'Other');
      const scannedDate = receipt.date ? new Date(receipt.date) : null;
      setReceiptDate(
        scannedDate && !Number.isNaN(scannedDate.getTime())
          ? scannedDate.toISOString().slice(0, 10)
          : currentDate()
      );
      setItems(receipt.items || []);
    } catch (err) {
      Alert.alert('Receipt scan failed', err.message || 'Unable to process the image.');
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------------
     SEND TO ADD EXPENSE
  --------------------------------------------------- */
  const goToAddExpense = () => {
    if (!title.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Check receipt details', 'Enter a merchant name and a valid total before continuing.');
      return;
    }
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(receiptDate);
    if (!dateMatch) {
      Alert.alert('Check receipt date', 'Enter the purchase date in YYYY-MM-DD format.');
      return;
    }
    const [, year, month, day] = dateMatch;
    const validatedDate = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      validatedDate.getFullYear() !== Number(year) ||
      validatedDate.getMonth() !== Number(month) - 1 ||
      validatedDate.getDate() !== Number(day)
    ) {
      Alert.alert('Check receipt date', 'Enter a valid purchase date.');
      return;
    }

    navigation.navigate('MainTabs', {
      screen: 'Expenses',
      params: {
        fromScan: true,
        prefillTitle: title,
        prefillAmount: amount,
        prefillCategory: category,
        prefillDate: receiptDate,
        prefillItems: items,
      },
    });
  };

  const updateItem = (index, field, value) => {
    setItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color="#1c2b48" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerEyebrow}>SMART SCAN</Text>
          <Text style={styles.headerTitle}>Scan a receipt</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Capture a receipt, review the details, then add it to your expenses.
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={startQrScan}>
            <Ionicons name="qr-code-outline" size={20} color="#fff" />
            <Text style={styles.actionText}>Scan QR</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtnOutline} onPress={pickImageFromGallery}>
            <Ionicons name="image-outline" size={20} color="#1c2b48" />
            <Text style={styles.actionTextOutline}>Pick Receipt</Text>
          </TouchableOpacity>
        </View>

        {isCameraVisible && (
          <View style={styles.cameraWrapper}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              onBarcodeScanned={handleBarcodeScanned}
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            />
            <View style={styles.cameraOverlay}>
              <Text style={styles.cameraText}>Point at QR code</Text>
            </View>
          </View>
        )}

        {imageUri && (
          <View style={styles.imageCard}>
            <Image source={{ uri: imageUri }} style={styles.image} />
            {loading && <ActivityIndicator style={{ marginTop: 8 }} />}
          </View>
        )}

        <View style={styles.detailsCard}>
          <View style={styles.detailsHeader}>
            <View>
              <Text style={styles.detailsHeading}>Review details</Text>
              <Text style={styles.detailsSubheading}>Tap any field to make corrections</Text>
            </View>
            <Ionicons name="create-outline" size={23} color="#4775d1" />
          </View>

          <Text style={styles.fieldLabel}>MERCHANT</Text>
          <TextInput
            style={styles.fieldInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Merchant name"
          />

          <Text style={styles.fieldLabel}>TOTAL AMOUNT (₹)</Text>
          <TextInput
            style={styles.fieldInput}
            value={amount}
            keyboardType="numeric"
            onChangeText={setAmount}
            placeholder="0.00"
          />

          <Text style={styles.fieldLabel}>CATEGORY</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={category} onValueChange={setCategory}>
              {categories.map((item) => (
                <Picker.Item key={item} label={item} value={item} />
              ))}
            </Picker>
          </View>

          <Text style={styles.fieldLabel}>PURCHASE DATE</Text>
          <TextInput
            style={styles.fieldInput}
            value={receiptDate}
            onChangeText={setReceiptDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />

          {items.length > 0 && (
            <>
              <Text style={styles.itemsHeading}>ITEMS · EDITABLE</Text>
              {items.map((item, index) => (
                <View key={`${item.name}-${index}`} style={styles.receiptItem}>
                  <TextInput
                    style={[styles.fieldInput, styles.itemName]}
                    value={item.name}
                    onChangeText={(value) => updateItem(index, 'name', value)}
                    placeholder="Item name"
                  />
                  <View style={styles.itemValues}>
                    {[
                      ['qty', 'Qty'],
                      ['rate', 'Rate'],
                      ['amount', 'Total'],
                    ].map(([field, label]) => (
                      <View key={field} style={styles.itemValue}>
                        <Text style={styles.itemValueLabel}>{label}</Text>
                        <TextInput
                          style={styles.itemInput}
                          value={String(item[field] ?? '')}
                          onChangeText={(value) => updateItem(index, field, value)}
                          keyboardType="decimal-pad"
                          placeholder="—"
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}

          {rawData ? (
            <>
              <Text style={styles.fieldLabel}>Receipt Text</Text>
              <Text style={styles.rawBox}>{rawData}</Text>
            </>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            onPress={goToAddExpense}
            disabled={loading}
          >
            <Text style={styles.primaryBtnText}>Continue to expense</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

/* ------------------ STYLES (unchanged) ------------------ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 54,
    paddingBottom: 18,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#edf0f5',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#f0f3f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  headerEyebrow: { color: '#4775d1', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  headerTitle: { color: '#1c2b48', fontSize: 21, fontWeight: '800', marginTop: 2 },
  content: { padding: 20, paddingBottom: 42 },
  intro: { color: '#718096', fontSize: 14, lineHeight: 20, marginBottom: 17 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  actionBtn: {
    flexDirection: 'row',
    backgroundColor: '#1c2b48',
    paddingVertical: 12,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  actionBtnOutline: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#d4dceb',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  actionText: { color: '#fff', marginLeft: 6, fontWeight: '700' },
  actionTextOutline: { color: '#1c2b48', marginLeft: 6, fontWeight: '700' },
  cameraWrapper: { height: 260, borderRadius: 18, overflow: 'hidden', marginBottom: 18 },
  cameraOverlay: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  cameraText: { color: '#fff', fontSize: 12 },
  imageCard: { backgroundColor: '#fff', borderRadius: 18, padding: 12, marginBottom: 16 },
  image: { width: '100%', height: 190, borderRadius: 12 },
  detailsCard: {
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
  detailsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  detailsHeading: { fontSize: 17, fontWeight: '800', color: '#1c2b48' },
  detailsSubheading: { fontSize: 12, color: '#8290a3', marginTop: 3 },
  fieldLabel: {
    marginTop: 8,
    marginBottom: 6,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#728099',
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#e1e7f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#fbfcfe',
    fontSize: 14,
    color: '#1c2b48',
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: '#e1e7f0',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fbfcfe',
  },
  itemsHeading: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#728099',
  },
  receiptItem: { borderTopWidth: 1, borderTopColor: '#edf0f5', paddingTop: 10, marginTop: 4 },
  itemName: { marginBottom: 8 },
  itemValues: { flexDirection: 'row', justifyContent: 'space-between' },
  itemValue: { width: '31%' },
  itemValueLabel: { color: '#8290a3', fontSize: 10, marginBottom: 4 },
  itemInput: {
    borderWidth: 1,
    borderColor: '#e1e7f0',
    borderRadius: 9,
    backgroundColor: '#fbfcfe',
    paddingHorizontal: 8,
    paddingVertical: 8,
    color: '#1c2b48',
    fontSize: 12,
  },
  rawBox: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 8,
    marginTop: 4,
    backgroundColor: '#f9fafb',
    color: '#475569',
  },
  primaryBtn: {
    backgroundColor: '#1c2b48',
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: 'center',
    marginTop: 20,
    gap: 8,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});