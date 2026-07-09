import { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { RootNavigator, navigationRef } from '@/navigation/RootNavigator';

// Sans handler, une notification reçue pendant que l'app est au premier plan ne s'affiche pas
// du tout — nécessaire pour que le bouton "🔔 Tester" (déclenchement immédiat) soit visible.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen;
      // navigationRef ne reflète le MainNavigator (seul endroit où 'Payday' existe) que si
      // l'utilisateur est connecté avec un couple actif — sinon le lien est silencieusement
      // ignoré, compromis assumé pour rester dans le périmètre de la demande.
      if (screen === 'Payday' && navigationRef.isReady()) {
        try {
          navigationRef.navigate('Payday');
        } catch {
          // MainNavigator pas monté (ex: déconnecté) — rien à faire.
        }
      }
    });
    return () => subscription.remove();
  }, []);

  return (
    <>
      <RootNavigator />
      <StatusBar style="auto" />
    </>
  );
}
