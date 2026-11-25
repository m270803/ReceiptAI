import React, { useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../ThemeContext';
import { requestApi } from '../utils/api';

const features = [
  { name: 'Scan receipt', subtitle: 'Capture a purchase', icon: 'scan-outline', type: 'Ionicons', screen: 'ScanReceipt' },
  { name: 'Add expense', subtitle: 'Log spending', icon: 'plus-circle', type: 'Feather', screen: 'Expenses' },
  { name: 'Income', subtitle: 'Track earnings', icon: 'trending-up', type: 'MaterialIcons', screen: 'Income' },
  { name: 'Budgets', subtitle: 'Set spending limits', icon: 'pie-chart-outline', type: 'Ionicons', screen: 'Budgets' },
  { name: 'Savings goals', subtitle: 'Make progress', icon: 'bullseye', type: 'FontAwesome5', screen: 'SavingsGoals' },
  { name: 'Ask ReceiptAI', subtitle: 'Get helpful answers', icon: 'message-circle', type: 'Feather', screen: 'AskAssistant' },
  { name: 'UPI payments', subtitle: 'Pay securely with Razorpay', icon: 'qr-code-outline', type: 'Ionicons', screen: 'UPIPayment' },
];

const { width } = Dimensions.get('window');
const cardWidth = (width - 56) / 2;

const formatCurrency = (amount = 0) =>
  `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

function FeatureIcon({ item, color }) {
  if (item.type === 'MaterialIcons') {
    return <MaterialIcons name={item.icon} size={22} color={color} />;
  }
  if (item.type === 'FontAwesome5') {
    return <FontAwesome5 name={item.icon} size={20} color={color} />;
  }
  if (item.type === 'Feather') {
    return <Feather name={item.icon} size={21} color={color} />;
  }
  return <Ionicons name={item.icon} size={22} color={color} />;
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const { currentTheme, setTheme } = useContext(ThemeContext);
  const [summary, setSummary] = useState(null);
  const isDark = currentTheme === 'dark';

  useEffect(() => {
    requestApi('/api/users/me', undefined, 'GET')
      .then((user) => setTheme(user.theme || 'auto'))
      .catch((error) => console.error('Unable to load saved theme:', error.message));
    requestApi('/api/insights', undefined, 'GET')
      .then(setSummary)
      .catch((error) => console.error('Unable to load dashboard summary:', error.message));
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea, isDark && styles.darkSafeArea]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>ReceiptAI</Text>
            <Text style={[styles.greeting, isDark && styles.lightText]}>Your money, in focus.</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            style={styles.profileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Ionicons name="person-outline" size={21} color="#1c2b48" />
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroEyebrow}>MONTHLY OVERVIEW</Text>
              <Text style={styles.heroTitle}>A clearer view{"\n"}of your finances</Text>
            </View>
            <View style={styles.heroIcon}>
              <Ionicons name="sparkles-outline" size={23} color="#fff" />
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Spent</Text>
              {summary ? <Text style={styles.summaryValue}>{formatCurrency(summary.totalExpenses)}</Text> : <ActivityIndicator color="#fff" />}
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Saved</Text>
              {summary ? <Text style={styles.summaryValue}>{formatCurrency(summary.savings)}</Text> : <ActivityIndicator color="#fff" />}
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, isDark && styles.lightText]}>Quick actions</Text>
            <Text style={[styles.sectionSubtitle, isDark && styles.mutedDarkText]}>
              Everything you need to stay on track
            </Text>
          </View>
        </View>

        <View style={styles.featureGrid}>
          {features.map((item, index) => {
            const tint = ['#3675e8', '#10a37f', '#ed8b35', '#8b5cf6', '#e05c83', '#168f9b', '#4775d1'][index];
            return (
              <TouchableOpacity
                key={item.name}
                accessibilityRole="button"
                style={[styles.featureCard, { width: cardWidth }, isDark && styles.darkCard]}
                onPress={() => navigation.navigate(item.screen)}
              >
                <View style={[styles.featureIcon, { backgroundColor: `${tint}18` }]}>
                  <FeatureIcon item={item} color={tint} />
                </View>
                <Text style={[styles.featureTitle, isDark && styles.lightText]}>{item.name}</Text>
                <Text style={[styles.featureSubtitle, isDark && styles.mutedDarkText]}>{item.subtitle}</Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={isDark ? '#94a3b8' : '#94a3b8'}
                  style={styles.featureArrow}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f7fb' },
  darkSafeArea: { backgroundColor: '#0c1424' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  brand: { color: '#4775d1', fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  greeting: { color: '#14213a', fontSize: 23, fontWeight: '800', marginTop: 4 },
  lightText: { color: '#f8fafc' },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#e8eefb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    backgroundColor: '#1c2b48',
    borderRadius: 24,
    padding: 21,
    marginBottom: 25,
    shadowColor: '#102040',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroEyebrow: { color: '#a9bddf', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 28, marginTop: 8 },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.16)',
    marginTop: 20,
    paddingTop: 15,
  },
  summaryItem: { flex: 1, minHeight: 42 },
  summaryLabel: { color: '#a9bddf', fontSize: 12, marginBottom: 4 },
  summaryValue: { color: '#fff', fontSize: 19, fontWeight: '700' },
  summaryDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 16 },
  sectionHeader: { marginBottom: 13 },
  sectionTitle: { color: '#14213a', fontSize: 18, fontWeight: '800' },
  sectionSubtitle: { color: '#7b879a', fontSize: 12, marginTop: 4 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  featureCard: {
    minHeight: 142,
    backgroundColor: '#fff',
    borderRadius: 19,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#edf0f5',
    shadowColor: '#13213c',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  darkCard: { backgroundColor: '#162238', borderColor: '#263650' },
  featureIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  featureTitle: { color: '#1c2b48', fontSize: 14, fontWeight: '700' },
  featureSubtitle: { color: '#8490a2', fontSize: 11, marginTop: 4 },
  featureArrow: { position: 'absolute', right: 15, top: 26 },
});
