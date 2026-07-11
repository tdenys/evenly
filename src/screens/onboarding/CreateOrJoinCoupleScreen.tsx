import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useStore } from '@/store/useStore';
import { errorMessage, notify } from '@/lib/alert';
import { colors, ink } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import Button from '@/components/ui/Button';

export default function CreateOrJoinCoupleScreen() {
  const createCouple = useStore((s) => s.createCouple);
  const joinCouple = useStore((s) => s.joinCouple);
  const signOut = useStore((s) => s.signOut);
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      await createCouple();
    } catch (err) {
      notify('Erreur', errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    try {
      await joinCouple(inviteCode);
    } catch (err) {
      notify('Erreur', errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenue !</Text>
      <Text style={styles.subtitle}>Crée votre couple ou rejoins celui de ton/ta partenaire.</Text>

      <Button title="Créer un couple" onPress={() => void handleCreate()} disabled={loading} />

      <Text style={styles.or}>OU</Text>

      <TextInput
        style={styles.input}
        placeholder="Code d'invitation"
        placeholderTextColor={ink(0.4)}
        autoCapitalize="characters"
        value={inviteCode}
        onChangeText={setInviteCode}
      />
      <Button title="Rejoindre avec ce code" variant="outline" onPress={() => void handleJoin()} disabled={loading} />

      <TouchableOpacity onPress={() => void signOut()} style={styles.signOut}>
        <Text style={styles.link}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg, padding: 24, gap: 12 },
  title: { fontFamily: fonts.spectralSemiBold, fontSize: 24, color: colors.ink, textAlign: 'center' },
  subtitle: { fontFamily: fonts.karlaMedium, fontSize: 14.5, color: ink(0.55), textAlign: 'center', marginBottom: 16 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.borderInput,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 14,
    fontFamily: fonts.karlaMedium,
    fontSize: 15,
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: 2,
  },
  or: { fontFamily: fonts.karlaBold, fontSize: 11, color: ink(0.4), textAlign: 'center', marginVertical: 4 },
  signOut: { marginTop: 32 },
  link: { fontFamily: fonts.karlaSemiBold, fontSize: 13, color: ink(0.4), textAlign: 'center' },
});
