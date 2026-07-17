import { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import {
  Spectral_500Medium,
  Spectral_600SemiBold,
  Spectral_700Bold,
} from '@expo-google-fonts/spectral';
import {
  Karla_400Regular,
  Karla_500Medium,
  Karla_600SemiBold,
  Karla_700Bold,
  Karla_800ExtraBold,
} from '@expo-google-fonts/karla';
import { RootNavigator, navigationRef } from '@/navigation/RootNavigator';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { checkAndApplyUpdate } from '@/lib/updates';

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
  const [fontsLoaded] = useFonts({
    Spectral_500Medium,
    Spectral_600SemiBold,
    Spectral_700Bold,
    Karla_400Regular,
    Karla_500Medium,
    Karla_600SemiBold,
    Karla_700Bold,
    Karla_800ExtraBold,
  });

  // Vérifie et applique une éventuelle mise à jour OTA dès le lancement — au lieu du
  // comportement par défaut (téléchargement silencieux, appliqué seulement au lancement
  // suivant), ce qui évite d'avoir à fermer/relancer l'app 2 fois à l'aveugle. Si une mise à
  // jour est trouvée, l'app redémarre elle-même (reloadAsync) ; sinon rien ne se passe.
  useEffect(() => {
    void checkAndApplyUpdate();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const screen = response.notification.request.content.data?.screen;
      // navigationRef ne reflète le MainNavigator (seul endroit où 'Payday' existe) que si
      // l'utilisateur est connecté avec un couple actif — sinon le lien est silencieusement
      // ignoré, compromis assumé pour rester dans le périmètre de la demande.
      if (screen === 'Payday' && navigationRef.isReady()) {
        try {
          navigationRef.navigate('Tabs', { screen: 'Payday' });
        } catch {
          // RootNavigatorStack pas monté (ex: déconnecté) — rien à faire.
        }
      }
    });
    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) return <LoadingScreen />;

  return (
    <>
      <RootNavigator />
      <StatusBar style="auto" />
    </>
  );
}
