import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStore } from '@/store/useStore';
import LoginScreen from '@/screens/auth/LoginScreen';
import SignUpScreen from '@/screens/auth/SignUpScreen';
import CreateOrJoinCoupleScreen from '@/screens/onboarding/CreateOrJoinCoupleScreen';
import WaitingForPartnerScreen from '@/screens/onboarding/WaitingForPartnerScreen';
import WaterfallScreen from '@/screens/waterfall/WaterfallScreen';
import EnvelopeFormScreen from '@/screens/waterfall/EnvelopeFormScreen';
import IncomeScreen from '@/screens/waterfall/IncomeScreen';
import PaydayScreen from '@/screens/payday/PaydayScreen';
import PaydayActionFormScreen from '@/screens/payday/PaydayActionFormScreen';
import SubscriptionsScreen from '@/screens/subscriptions/SubscriptionsScreen';
import SubscriptionFormScreen from '@/screens/subscriptions/SubscriptionFormScreen';

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

export type MainStackParamList = {
  Waterfall: undefined;
  EnvelopeForm: { envelopeId?: string; parentId?: string };
  Income: undefined;
  Payday: undefined;
  PaydayActionForm: { actionId?: string; ownerId: string };
  Subscriptions: undefined;
  SubscriptionForm: { subscriptionId?: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();

// Permet de naviguer depuis en dehors de l'arbre React (ex: au tap sur une notification, voir
// App.tsx) — reflète le navigateur actuellement monté (Auth ou Main selon `status`), donc un
// `.navigate('Payday')` n'a de sens que si MainNavigator est affiché (statut "ready").
export const navigationRef = createNavigationContainerRef<MainStackParamList>();

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
    <MainStack.Navigator initialRouteName="Waterfall">
      <MainStack.Screen name="Waterfall" component={WaterfallScreen} options={{ title: 'Budget' }} />
      <MainStack.Screen
        name="EnvelopeForm"
        component={EnvelopeFormScreen}
        options={{ title: 'Enveloppe' }}
      />
      <MainStack.Screen name="Income" component={IncomeScreen} options={{ title: 'Revenus' }} />
      <MainStack.Screen name="Payday" component={PaydayScreen} options={{ title: 'Répartition' }} />
      <MainStack.Screen
        name="PaydayActionForm"
        component={PaydayActionFormScreen}
        options={{ title: 'Action' }}
      />
      <MainStack.Screen
        name="Subscriptions"
        component={SubscriptionsScreen}
        options={{ title: 'Abonnements' }}
      />
      <MainStack.Screen
        name="SubscriptionForm"
        component={SubscriptionFormScreen}
        options={{ title: 'Abonnement' }}
      />
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
    <NavigationContainer ref={navigationRef}>
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
