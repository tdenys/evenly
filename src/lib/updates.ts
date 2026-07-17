import { Platform } from 'react-native';
import * as Updates from 'expo-updates';

export interface CurrentUpdateInfo {
  isEmbeddedLaunch: boolean;
  createdAt: Date | null;
  channel: string | null;
}

/** `null` sur web ou en dev client (expo-updates n'a pas d'équivalent web, et en dev client on
 * tourne toujours la version embarquée locale, jamais une mise à jour OTA). */
export function getCurrentUpdateInfo(): CurrentUpdateInfo | null {
  if (Platform.OS === 'web' || __DEV__) return null;
  return {
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    createdAt: Updates.createdAt,
    channel: Updates.channel,
  };
}

export type UpdateCheckResult = 'updated' | 'up-to-date' | 'unavailable';

/** Vérifie, télécharge ET applique immédiatement une mise à jour OTA si disponible (reloadAsync),
 * plutôt que de la télécharger silencieusement pour un prochain lancement (comportement par
 * défaut d'expo-updates, désactivé dans app.json via checkAutomatically: "NEVER") — évite d'avoir
 * à fermer/relancer l'app 2 fois sans savoir si une mise à jour existe. `reloadAsync()` redémarre
 * l'app avant que la suite de cette fonction ne s'exécute si une mise à jour est trouvée. */
export async function checkAndApplyUpdate(): Promise<UpdateCheckResult> {
  if (Platform.OS === 'web' || __DEV__) return 'unavailable';
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return 'up-to-date';
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
    return 'updated';
  } catch {
    return 'unavailable';
  }
}
