import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '@/store/useStore';
import { colors, ink } from '@/theme/colors';
import { fonts } from '@/theme/typography';

const AUTO_POLL_MS = 4000;

export default function WaitingForPartnerScreen() {
  const couple = useStore((s) => s.couple);
  const refresh = useStore((s) => s.refresh);
  const signOut = useStore((s) => s.signOut);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  // Pull-to-refresh has no equivalent on web, so poll automatically while this
  // screen is visible — it's the only way this device learns the partner joined.
  useEffect(() => {
    const interval = setInterval(() => void refresh(), AUTO_POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleCopy = async () => {
    if (!couple?.inviteCode) return;
    await Clipboard.setStringAsync(couple.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codeChars = (couple?.inviteCode ?? '').padEnd(6, ' ').split('');

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
    >
      <Text style={styles.title}>En attente de ton/ta partenaire</Text>
      <Text style={styles.subtitle}>Partage-lui ce code pour qu'il/elle rejoigne votre couple :</Text>

      <View style={styles.codeRow}>
        {codeChars.map((char, i) => (
          <View key={i} style={styles.codeBox}>
            <Text style={styles.codeChar}>{char.trim()}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.copyButton} onPress={() => void handleCopy()}>
        <Text style={styles.copyButtonText}>{copied ? '✓ Copié' : '📋 Copier le code'}</Text>
      </TouchableOpacity>

      <View style={styles.statusRow}>
        <View style={styles.pulsingDot} />
        <Text style={styles.statusText}>En attente de connexion…</Text>
      </View>

      <TouchableOpacity onPress={() => void signOut()} style={styles.signOut}>
        <Text style={styles.link}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', backgroundColor: colors.bg, padding: 24, gap: 12 },
  title: { fontFamily: fonts.spectralSemiBold, fontSize: 22, color: colors.ink, textAlign: 'center' },
  subtitle: { fontFamily: fonts.karlaMedium, fontSize: 14.5, color: ink(0.55), textAlign: 'center', marginBottom: 16 },
  codeRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  codeBox: {
    width: 42,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeChar: { fontFamily: fonts.spectralSemiBold, fontSize: 22, color: colors.primary },
  copyButton: {
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  copyButtonText: { fontFamily: fonts.karlaBold, fontSize: 13, color: colors.primary },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 },
  pulsingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentB, opacity: 0.8 },
  statusText: { fontFamily: fonts.karlaMedium, fontSize: 13, color: ink(0.55) },
  signOut: { marginTop: 32 },
  link: { fontFamily: fonts.karlaSemiBold, fontSize: 13, color: ink(0.4), textAlign: 'center' },
});
