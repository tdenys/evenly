import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import { errorMessage, notify } from '@/lib/alert';
import { colors, ink } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import Button from '@/components/ui/Button';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const signIn = useStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      notify('Connexion impossible', errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Evenly</Text>
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
      <Button title={loading ? 'Connexion...' : 'Se connecter'} onPress={() => void handleSubmit()} disabled={loading} />
      <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
        <Text style={styles.link}>Pas encore de compte ? S'inscrire</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: colors.bg, padding: 24, gap: 12 },
  title: {
    fontFamily: fonts.spectralSemiBold,
    fontSize: 30,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 24,
  },
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
