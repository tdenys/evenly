import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import { errorMessage, notify } from '@/lib/alert';
import { colors, ink } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import Button from '@/components/ui/Button';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export default function SignUpScreen({ navigation }: Props) {
  const signUp = useStore((s) => s.signUp);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!displayName.trim() || !email.trim() || password.length < 6) {
      notify('Formulaire incomplet', 'Renseigne ton prénom, un email et un mot de passe (6 caractères min).');
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, displayName.trim());
    } catch (err) {
      notify('Inscription impossible', errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Evenly</Text>
      <Text style={styles.subtitle}>Créer un compte</Text>
      <TextInput
        style={styles.input}
        placeholder="Ton prénom"
        placeholderTextColor={ink(0.4)}
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={ink(0.4)}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor={ink(0.4)}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title={loading ? 'Création...' : "S'inscrire"} onPress={() => void handleSubmit()} disabled={loading} />
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Déjà un compte ? Se connecter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg, padding: 24, gap: 12 },
  title: { fontFamily: fonts.spectralSemiBold, fontSize: 30, color: colors.ink, textAlign: 'center' },
  subtitle: { fontFamily: fonts.karlaMedium, fontSize: 14.5, color: ink(0.55), textAlign: 'center', marginBottom: 20 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.borderInput,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 14,
    fontFamily: fonts.karlaMedium,
    fontSize: 15,
    color: colors.ink,
  },
  link: { fontFamily: fonts.karlaSemiBold, fontSize: 13.5, color: colors.primary, textAlign: 'center', marginTop: 16 },
});
