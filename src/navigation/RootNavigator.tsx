import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStore } from '@/store/useStore';
import LoginScreen from '@/screens/auth/LoginScreen';
import SignUpScreen from '@/screens/auth/SignUpScreen';
import CreateOrJoinCoupleScreen from '@/screens/onboarding/CreateOrJoinCoupleScreen';
import WaitingForPartnerScreen from '@/screens/onboarding/WaitingForPartnerScreen';
import DashboardScreen from '@/screens/DashboardScreen';
import AddExpenseScreen from '@/screens/AddExpenseScreen';
import WaterfallScreen from '@/screens/waterfall/WaterfallScreen';
import EnvelopeDetailScreen from '@/screens/waterfall/EnvelopeDetailScreen';
import EnvelopeFormScreen from '@/screens/waterfall/EnvelopeFormScreen';
import IncomeScreen from '@/screens/waterfall/IncomeScreen';

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

export type MainStackParamList = {
  Dashboard: undefined;
  AddExpense: undefined;
  Waterfall: undefined;
  EnvelopeDetail: { envelopeId: string };
  EnvelopeForm: { envelopeId?: string; parentId?: string };
  Income: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator>
      <MainStack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Budget Couple' }}
      />
      <MainStack.Screen
        name="AddExpense"
        component={AddExpenseScreen}
        options={{ title: 'Ajouter une dépense' }}
      />
      <MainStack.Screen name="Waterfall" component={WaterfallScreen} options={{ title: 'Budget' }} />
      <MainStack.Screen
        name="EnvelopeDetail"
        component={EnvelopeDetailScreen}
        options={{ title: 'Enveloppe' }}
      />
      <MainStack.Screen
        name="EnvelopeForm"
        component={EnvelopeFormScreen}
        options={{ title: 'Enveloppe' }}
      />
      <MainStack.Screen name="Income" component={IncomeScreen} options={{ title: 'Revenus' }} />
    </MainStack.Navigator>
  );
}

function LoadingScreen() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export function RootNavigator() {
  const status = useStore((s) => s.status);
  const init = useStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <NavigationContainer>
      {status === 'loading' && <LoadingScreen />}
      {status === 'signedOut' && <AuthNavigator />}
      {status === 'needsCouple' && <CreateOrJoinCoupleScreen />}
      {status === 'waitingForPartner' && <WaitingForPartnerScreen />}
      {status === 'ready' && <MainNavigator />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
