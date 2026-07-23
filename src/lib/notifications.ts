import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// expo-notifications n'a aucun support web — toutes les fonctions sont no-op sur cette
// plateforme (voir Platform.OS ci-dessous), l'écran appelant doit aussi masquer l'UI concernée.
const PAYDAY_REMINDER_ID = 'payday-reminder';

// `body` est calculé par l'appelant (PaydayScreen, via describeReminderBody) à partir des
// virements pas encore cochés — content n'est donc plus une constante partagée mais construit
// par appel, pour refléter le body dynamique du moment.
function buildContent(body: string): Notifications.NotificationContentInput {
  return { title: 'Jour de versement', body, data: { screen: 'Payday' } };
}

export async function getNotificationPermissionGranted(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const status = await Notifications.getPermissionsAsync();
  return status.granted;
}

/** Ne demande la permission que sur une action explicite de l'utilisateur (Enregistrer/Tester),
 * jamais automatiquement au chargement d'un écran. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const status = await Notifications.requestPermissionsAsync();
  return status.granted;
}

/** Reprogramme le rappel mensuel — remplace toujours l'éventuel rappel précédent (identifiant
 * fixe), donc jamais de doublon même si appelé plusieurs fois. */
export async function schedulePaydayReminder(day: number, body: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(PAYDAY_REMINDER_ID);
  await Notifications.scheduleNotificationAsync({
    identifier: PAYDAY_REMINDER_ID,
    content: buildContent(body),
    trigger: { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day, hour: 9, minute: 0 },
  });
}

export async function cancelPaydayReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(PAYDAY_REMINDER_ID);
}

/** Déclenchement immédiat, pour le bouton "Tester la notification" — identifiant distinct du
 * rappel programmé pour ne pas l'écraser. */
export async function sendTestNotification(body: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.scheduleNotificationAsync({ content: buildContent(body), trigger: null });
}
