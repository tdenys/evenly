import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  createNavigationContainerRef,
  NavigationContainer,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ChartLine, Clock, House, Plus, SquareStack, User, type LucideIcon } from 'lucide-react-native';
import { useStore } from '@/store/useStore';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import LoadingScreen from '@/components/ui/LoadingScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import SignUpScreen from '@/screens/auth/SignUpScreen';
import CreateOrJoinCoupleScreen from '@/screens/onboarding/CreateOrJoinCoupleScreen';
import WaitingForPartnerScreen from '@/screens/onboarding/WaitingForPartnerScreen';
import WaterfallScreen from '@/screens/waterfall/WaterfallScreen';
import EnvelopeFormScreen from '@/screens/waterfall/EnvelopeFormScreen';
import IncomeFormScreen from '@/screens/waterfall/IncomeFormScreen';
import PaydayScreen from '@/screens/payday/PaydayScreen';
import PaydayActionFormScreen from '@/screens/payday/PaydayActionFormScreen';
import SubscriptionsScreen from '@/screens/subscriptions/SubscriptionsScreen';
import SubscriptionFormScreen from '@/screens/subscriptions/SubscriptionFormScreen';
import HistoryScreen from '@/screens/history/HistoryScreen';
import SettingsScreen from '@/screens/settings/SettingsScreen';

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

// Les 5 sections principales, désormais des onglets persistants plutôt qu'une pile classique.
// Revenus n'est plus un onglet à part : c'est un modal atteint depuis la carte "Revenu total du
// couple" sur Budget (voir IncomeForm ci-dessous) — les revenus se modifient rarement, contrairement
// aux onglets "contenu qu'on consulte". Paramètres reste le dernier onglet, réservé au réglages de
// compte (prénoms, comptes, mises à jour), volontairement placé tout à droite.
export type MainTabParamList = {
  Waterfall: undefined;
  Payday: undefined;
  Subscriptions: undefined;
  History: undefined;
  Settings: undefined;
};

// Les formulaires (et les onglets eux-mêmes) vivent au niveau racine — les formulaires
// s'affichent en modale par-dessus la tab bar, pas comme un 5e onglet.
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<MainTabParamList> | undefined;
  EnvelopeForm: { envelopeId?: string; parentId?: string; period: string };
  IncomeForm: undefined;
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

const TAB_ICONS: Record<keyof MainTabParamList, LucideIcon> = {
  Waterfall: House,
  Payday: Clock,
  Subscriptions: SquareStack,
  History: ChartLine,
  Settings: User,
};
const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  Waterfall: 'Budget',
  Payday: 'Répartition',
  Subscriptions: 'Abonnements',
  History: 'Historique',
  Settings: 'Paramètres',
};

function tabIcon(route: keyof MainTabParamList) {
  const Icon = TAB_ICONS[route];
  return ({ color }: { color: string }) => <Icon size={22} color={color} strokeWidth={2} />;
}

function HeaderAddButton({ onPress, color }: { onPress: () => void; color: string }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={8} style={headerStyles.addButton}>
      <Plus size={16} color={color} strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

// Petit carré sombre devant le titre de chaque écran d'onglet — présent de façon cohérente sur
// tous les écrans de la maquette importée, appliqué ici une seule fois plutôt que par écran.
function HeaderTitleWithMark({ children }: { children?: string }) {
  return (
    <View style={headerStyles.titleRow}>
      <View style={headerStyles.mark} />
      <Text style={headerStyles.titleText}>{children}</Text>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.section,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { width: 18, height: 18, borderRadius: 5, backgroundColor: colors.ink },
  titleText: { fontFamily: fonts.bold, fontSize: 16.5, color: colors.ink },
});

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tertiary,
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 10 },
        tabBarStyle: { borderTopColor: colors.borderSubtle, backgroundColor: colors.surface },
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 16.5, color: colors.ink },
        headerTitle: ({ children }) => <HeaderTitleWithMark>{children}</HeaderTitleWithMark>,
      }}
    >
      <Tab.Screen
        name="Waterfall"
        component={WaterfallScreen}
        options={{
          title: TAB_LABELS.Waterfall,
          tabBarLabel: TAB_LABELS.Waterfall,
          tabBarIcon: tabIcon('Waterfall'),
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
            <HeaderAddButton
              onPress={() => navigationRef.navigate('SubscriptionForm', {})}
              color={tintColor ?? colors.primary}
            />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: TAB_LABELS.History,
          tabBarLabel: TAB_LABELS.History,
          tabBarIcon: tabIcon('History'),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: TAB_LABELS.Settings,
          tabBarLabel: TAB_LABELS.Settings,
          tabBarIcon: tabIcon('Settings'),
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
        name="IncomeForm"
        component={IncomeFormScreen}
        options={{ presentation: 'modal', headerShown: true, title: 'Revenus' }}
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
