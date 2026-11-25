import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { clearSession, getSessionUser, requestApi, updateSessionUser } from '../utils/api';

const { height } = Dimensions.get('window');

export default function OTPVerification({ route, navigation }) {
  const { uid, email } = route.params;
  const [emailOtp, setEmailOtp] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [developmentOtp, setDevelopmentOtp] = useState(false);

  const sendOtp = async (showSuccess = false) => {
    if ((await getSessionUser())?.uid !== uid) {
      Alert.alert('Session expired', 'Please sign up again to request a verification code.');
      return;
    }

    setIsSending(true);
    try {
      const result = await requestApi('/api/auth/send-otp', {});
      setDevelopmentOtp(Boolean(result.developmentOtp));
      if (showSuccess) {
        Alert.alert(
          result.developmentOtp ? 'Development code ready' : 'Code sent',
          result.developmentOtp
            ? 'Enter the development code configured for this server.'
            : `A new verification code was sent to ${email}.`
        );
      }
    } catch (error) {
      Alert.alert('Unable to send code', error.message);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    sendOtp();
  }, []);

  const verifyEmailOtp = async () => {
    if (emailOtp.length !== (developmentOtp ? 4 : 6)) {
      return Alert.alert(
        'Invalid OTP',
        developmentOtp ? 'Please enter the 4-digit development code.' : 'Please enter the 6-digit code.'
      );
    }

    if ((await getSessionUser())?.uid !== uid) {
      return Alert.alert('Session expired', 'Please sign up again to verify your email.');
    }

    setIsVerifying(true);
    try {
      const result = await requestApi('/api/auth/verify-otp', { otp: emailOtp });
      await updateSessionUser(result.user);
      await clearSession();
      Alert.alert('Email verified!', '', [
        { text: 'Continue', onPress: () => navigation.replace('Login') },
      ]);
    } catch (err) {
      Alert.alert('Verification failed', err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.bottomContainer}>
        <Text style={styles.loginTitle}>Verify your Email</Text>
        <Text style={styles.loginSubtitle}>
          {developmentOtp
            ? 'Enter the configured 4-digit development code.'
            : `Enter the 6-digit OTP sent to ${email}`}
        </Text>

        <Text style={styles.label}>EMAIL OTP</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter OTP"
          value={emailOtp}
          onChangeText={setEmailOtp}
          keyboardType="number-pad"
          maxLength={developmentOtp ? 4 : 6}
        />

        <TouchableOpacity
          style={styles.otpButton}
          onPress={verifyEmailOtp}
          disabled={isVerifying}
        >
          <Text style={styles.otpButtonText}>
            {isVerifying ? 'Verifying...' : 'Verify'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => sendOtp(true)} disabled={isSending}>
          <Text style={styles.resendText}>
            {isSending ? 'Sending code...' : 'Resend code'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c2b48',
  },
  topContainer: {
    height: height * 0.10,
    justifyContent: 'center',
    alignItems: 'flex-start', // 'left' is invalid
    paddingLeft: 20,
    paddingTop: 30,
    backgroundColor: '#1c2b48',
    borderBottomRightRadius: 90,
  },
  bottomContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 90,
    paddingHorizontal: 30,
    paddingTop: 40,
  },
  loginTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 6,
    textAlign: 'center',
  },
  loginSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  label: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#e2e2e2',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 25,
  },
  otpButton: {
    backgroundColor: '#111',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  otpButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  resendText: {
    color: '#1c2b48',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 18,
  },
});
