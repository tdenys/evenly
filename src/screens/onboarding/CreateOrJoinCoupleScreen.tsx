import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useStore } from '@/store/useStore';
import { errorMessage, notify } from '@/lib/alert';

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

      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
        <Text style={styles.buttonText}>Créer un couple</Text>
      </TouchableOpacity>

      <Text style={styles.or}>— ou —</Text>

      <TextInput
        style={styles.input}
        placeholder="Code d'invitation"
        autoCapitalize="characters"
        value={inviteCode}
        onChangeText={setInviteCode}
      />
      <TouchableOpacity style={styles.buttonOutline} onPress={handleJoin} disabled={loading}>
        <Text style={styles.buttonOutlineText}>Rejoindre avec ce code</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => void signOut()} style={styles.signOut}>
        <Text style={styles.link}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#555', textAlign: 'center', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 2,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonOutline: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonOutlineText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
  or: { textAlign: 'center', color: '#999', marginVertical: 4 },
  signOut: { marginTop: 32 },
  link: { color: '#999', textAlign: 'center' },
});
