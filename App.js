import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import InterfaceScreen from './screens/InterfaceScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import OTPVerificationScreen from './screens/OTPVerificationScreen';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import ScanReceiptScreen from './screens/ScanReceiptScreen';
import AddExpenseScreen from './screens/AddExpenseScreen';
import BudgetsScreen from './screens/BudgetsScreen';
import IncomeTrackingScreen from './screens/IncomeTrackingScreen';
import SavingsGoalScreen from './screens/SavingsGoalScreen';
import ViewInsightsScreen from './screens/ViewInsightsScreen';
import AskAssistantScreen from './screens/AskAssistantScreen';
import MockPaymentScreen from './screens/MockPaymentScreen';
import { ThemeProvider } from './ThemeContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#1c2b48',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
        tabBarStyle: {
          height: 68,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: '#fff',
          borderTopColor: '#e8edf4',
          elevation: 12,
        },
        tabBarIcon: ({ color, size, focused }) => {
          const iconNames = {
            Home: focused ? 'home' : 'home-outline',
            Expenses: focused ? 'wallet' : 'wallet-outline',
            Insights: focused ? 'analytics' : 'analytics-outline',
            Profile: focused ? 'person-circle' : 'person-circle-outline',
          };
          return <Ionicons name={iconNames[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Expenses" component={AddExpenseScreen} options={{ title: 'Expenses' }} />
      <Tab.Screen name="Insights" component={ViewInsightsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <NavigationContainer documentTitle={{ formatter: () => 'ReceiptAI' }}>
        <Stack.Navigator
          initialRouteName="Interface"
          screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
        >
          <Stack.Screen name="Interface" component={InterfaceScreen} options={{ animation: 'fade' }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ animation: 'fade' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="ScanReceipt" component={ScanReceiptScreen} />
          <Stack.Screen name="Budgets" component={BudgetsScreen} />
          <Stack.Screen name="Income" component={IncomeTrackingScreen} />
          <Stack.Screen name="SavingsGoals" component={SavingsGoalScreen} />
          <Stack.Screen name="AskAssistant" component={AskAssistantScreen} />
          <Stack.Screen name="MockPayment" component={MockPaymentScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}
