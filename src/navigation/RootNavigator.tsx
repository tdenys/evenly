import { useEffect } from 'react';
import { Text } from 'react-native';
import {
  createNavigationContainerRef,
  NavigationContainer,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useStore } from '@/store/useStore';
import { colors, ink } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import LoadingScreen from '@/components/ui/LoadingScreen';
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

// Les 4 sections principales, désormais des onglets persistants plutôt qu'une pile classique.
export type MainTabParamList = {
  Waterfall: undefined;
  Income: undefined;
  Payday: undefined;
  Subscriptions: undefined;
};

// Les formulaires (et les onglets eux-mêmes) vivent au niveau racine — les formulaires
// s'affichent en modale par-dessus la tab bar, pas comme un 5e onglet.
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList> | undefined;
  EnvelopeForm: { envelopeId?: string; parentId?: string };
  PaydayActionForm: { actionId?: string; ownerId: string };
  SubscriptionForm: { subscriptionId?: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Permet de naviguer depuis en dehors de l'arbre React (ex: au tap sur une notification, voir
// App.tsx) — reflète le navigateur actuellement monté (Auth ou Root selon `status`), donc un
// `.navigate('Tabs', { screen: 'Payday' })` n'a de sens que si RootStack est affiché (statut
// "ready").
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Waterfall: '📊',
  Income: '💶',
  Payday: '🔀',
  Subscriptions: '📱',
};
const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  Waterfall: 'Budget',
  Income: 'Revenus',
  Payday: 'Répartition',
  Subscriptions: 'Abonnements',
};

function tabIcon(route: keyof MainTabParamList) {
  return ({ focused }: { focused: boolean }) => (
    <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.4 }}>{TAB_ICONS[route]}</Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: ink(0.4),
        tabBarLabelStyle: { fontFamily: fonts.karlaBold, fontSize: 10 },
        tabBarStyle: { borderTopColor: colors.borderSubtle, backgroundColor: colors.surface },
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.karlaBold, fontSize: 16.5, color: colors.ink },
      }}
    >
      <Tab.Screen
        name="Waterfall"
        component={WaterfallScreen}
        options={{
          title: TAB_LABELS.Waterfall,
          tabBarLabel: TAB_LABELS.Waterfall,
          tabBarIcon: tabIcon('Waterfall'),
          headerRight: ({ tintColor }) => (
            <Text
              accessibilityRole="button"
              onPress={() => navigationRef.navigate('EnvelopeForm', {})}
              style={{ fontSize: 22, color: tintColor ?? colors.primary, paddingHorizontal: 16 }}
            >
              +
            </Text>
          ),
        }}
      />
      <Tab.Screen
        name="Income"
        component={IncomeScreen}
        options={{
          title: TAB_LABELS.Income,
          tabBarLabel: TAB_LABELS.Income,
          tabBarIcon: tabIcon('Income'),
        }}
      />
      <Tab.Screen
        name="Payday"
        component={PaydayScreen}
        options={{
          title: TAB_LABELS.Payday,
          tabBarLabel: TAB_LABELS.Payday,
          tabBarIcon: tabIcon('Payday'),
        }}
      />
      <Tab.Screen
        name="Subscriptions"
        component={SubscriptionsScreen}
        options={{
          title: TAB_LABELS.Subscriptions,
          tabBarLabel: TAB_LABELS.Subscriptions,
          tabBarIcon: tabIcon('Subscriptions'),
          headerRight: ({ tintColor }) => (
            <Text
              accessibilityRole="button"
              onPress={() => navigationRef.navigate('SubscriptionForm', {})}
              style={{ fontSize: 22, color: tintColor ?? colors.primary, paddingHorizontal: 16 }}
            >
              +
            </Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function RootNavigatorStack() {
  return (
    <RootStack.Navigator>
      <RootStack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false }} />
      <RootStack.Screen
        name="EnvelopeForm"
        component={EnvelopeFormScreen}
        options={{ presentation: 'modal', headerShown: true, title: 'Enveloppe' }}
      />
      <RootStack.Screen
        name="PaydayActionForm"
        component={PaydayActionFormScreen}
        options={{ presentation: 'modal', headerShown: true, title: 'Action' }}
      />
      <RootStack.Screen
        name="SubscriptionForm"
        component={SubscriptionFormScreen}
        options={{ presentation: 'modal', headerShown: true, title: 'Abonnement' }}
      />
    </RootStack.Navigator>
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
      {status === 'ready' && <RootNavigatorStack />}
    </NavigationContainer>
  );
}
