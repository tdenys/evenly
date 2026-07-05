import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '@/store/useStore';
import { errorMessage, notify } from '@/lib/alert';
import { formatAmount } from '@/lib/format';

export default function IncomeScreen() {
  const profile = useStore((s) => s.profile);
  const partner = useStore((s) => s.partner);
  const updateMyIncome = useStore((s) => s.updateMyIncome);
  const refresh = useStore((s) => s.refresh);
  const [income, setIncome] = useState(String(profile?.netIncome ?? 0));
  const [saving, setSaving] = useState(false);

  // S'assure que le revenu du/de la partenaire affiché ci-dessous n'est pas périmé — voir le
  // commentaire équivalent dans WaterfallScreen sur pourquoi useFocusEffect et pas useEffect.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const handleSave = async () => {
    const parsed = Number(income.replace(',', '.'));
    if (Number.isNaN(parsed) || parsed < 0) {
      notify('Montant invalide', 'Renseigne un revenu net valide.');
      return;
    }
    setSaving(true);
    try {
      await updateMyIncome(parsed);
      notify('Enregistré', 'Ton revenu net a été mis à jour.');
    } catch (err) {
      notify('Erreur', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Mon revenu net</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={income}
        onChangeText={setIncome}
      />
      <TouchableOpacity style={styles.button} onPress={() => void handleSave()} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Revenu de {partner?.displayName ?? 'ton/ta partenaire'}</Text>
      <Text style={styles.readOnlyValue}>{formatAmount(partner?.netIncome ?? 0)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginTop: 20, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 20,
    fontWeight: '700',
  },
  readOnlyValue: { fontSize: 20, fontWeight: '700', color: '#555' },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
