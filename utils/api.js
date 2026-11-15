import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const TOKEN_KEY = '@raseed/accessToken';
const USER_KEY = '@raseed/user';
const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
const defaultHost =
  Platform.OS === 'android' ? '10.0.2.2' : Platform.OS === 'web' ? 'localhost' : expoHost || 'localhost';

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || `http://${defaultHost}:8082`
).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function requestApi(path, body, method = 'POST') {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(method === 'GET' || method === 'DELETE' ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(method === 'GET' || method === 'DELETE' ? {} : { body: JSON.stringify(body || {}) }),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError('The server returned an invalid response.', response.status);
  }

  if (!response.ok) {
    throw new ApiError(data?.error || 'The server could not complete the request.', response.status);
  }

  return data;
}

async function saveSession({ token, user }) {
  await Promise.all([
    AsyncStorage.setItem(TOKEN_KEY, token),
    AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
  ]);
}

export async function registerAccount(details) {
  const session = await requestApi('/api/auth/register', details);
  await saveSession(session);
  return session.user;
}

export async function loginAccount(details) {
  const session = await requestApi('/api/auth/login', details);
  await saveSession(session);
  return session.user;
}

export async function updateSessionUser(user) {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getSessionUser() {
  const storedUser = await AsyncStorage.getItem(USER_KEY);
  return storedUser ? JSON.parse(storedUser) : null;
}

export async function restoreSession() {
  if (!(await AsyncStorage.getItem(TOKEN_KEY))) return null;
  try {
    const user = await requestApi('/api/users/me', undefined, 'GET');
    await updateSessionUser(user);
    return user;
  } catch (error) {
    if (error.status === 401) await clearSession();
    throw error;
  }
}

export async function clearSession() {
  await Promise.all([AsyncStorage.removeItem(TOKEN_KEY), AsyncStorage.removeItem(USER_KEY)]);
}
