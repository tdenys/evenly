import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useStore } from '@/store/useStore';

const AUTO_POLL_MS = 4000;

export default function WaitingForPartnerScreen() {
  const couple = useStore((s) => s.couple);
  const refresh = useStore((s) => s.refresh);
  const signOut = useStore((s) => s.signOut);
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
    >
      <Text style={styles.title}>En attente de ton/ta partenaire</Text>
      <Text style={styles.subtitle}>Partage-lui ce code pour qu'il/elle rejoigne votre couple :</Text>
      <View style={styles.codeBox}>
        <Text style={styles.code}>{couple?.inviteCode}</Text>
      </View>
      <TouchableOpacity style={styles.button} onPress={() => void handleRefresh()} disabled={refreshing}>
        <Text style={styles.buttonText}>{refreshing ? 'Vérification...' : "Il/elle a rejoint ?"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => void signOut()} style={styles.signOut}>
        <Text style={styles.link}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#555', textAlign: 'center', marginBottom: 16 },
  codeBox: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  code: { fontSize: 36, fontWeight: '800', letterSpacing: 8, color: '#2563eb' },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  signOut: { marginTop: 32 },
  link: { color: '#999', textAlign: 'center' },
});
