import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '@/navigation/RootNavigator';
import { useStore } from '@/store/useStore';
import { errorMessage, notify } from '@/lib/alert';

type Props = NativeStackScreenProps<MainStackParamList, 'AddExpense'>;

const CATEGORIES = ['Courses', 'Logement', 'Sorties', 'Transport', 'Santé', 'Autre'];

export default function AddExpenseScreen({ navigation }: Props) {
  const addExpense = useStore((s) => s.addExpense);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const parsedAmount = Number(amount.replace(',', '.'));
    if (!parsedAmount || parsedAmount <= 0) {
      notify('Montant invalide', 'Renseigne un montant supérieur à 0.');
      return;
    }
    setSaving(true);
    try {
      await addExpense(parsedAmount, category, label.trim() || undefined);
      navigation.goBack();
    } catch (err) {
      notify('Erreur', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Montant</Text>
      <TextInput
        style={styles.amountInput}
        placeholder="0.00"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
      />

      <Text style={styles.label}>Catégorie</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, category === c && styles.chipSelected]}
            onPress={() => setCategory(c)}
          >
            <Text style={[styles.chipText, category === c && styles.chipTextSelected]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Libellé (optionnel)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex : Courses Carrefour"
        value={label}
        onChangeText={setLabel}
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Ajout...' : 'Ajouter'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { color: '#333' },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
