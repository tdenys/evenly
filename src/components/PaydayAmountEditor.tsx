import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { ManualPaydayAmount } from '@/core/payday/types';

interface Props {
  value: ManualPaydayAmount;
  onChange: (amount: ManualPaydayAmount) => void;
}

type PaydayAmountType = ManualPaydayAmount['type'];

const TYPE_LABELS: Record<PaydayAmountType, string> = {
  fixed: 'Montant fixe',
  percent_salary: '% du salaire',
  percent_remaining: '% du reste',
  remainder: 'Le reste',
};

const TYPES: PaydayAmountType[] = ['fixed', 'percent_salary', 'percent_remaining', 'remainder'];

function numericFieldValue(amount: ManualPaydayAmount): string {
  if (amount.type === 'fixed') return String(amount.value);
  if (amount.type === 'percent_salary' || amount.type === 'percent_remaining') return String(amount.pct);
  return '';
}

function withType(type: PaydayAmountType, numericValue: number): ManualPaydayAmount {
  switch (type) {
    case 'fixed':
      return { type: 'fixed', value: numericValue };
    case 'percent_salary':
      return { type: 'percent_salary', pct: numericValue };
    case 'percent_remaining':
      return { type: 'percent_remaining', pct: numericValue };
    case 'remainder':
      return { type: 'remainder' };
  }
}

export default function PaydayAmountEditor({ value, onChange }: Props) {
  // Le texte brut est la source de vérité pour l'affichage (pas la valeur numérique déjà
  // parsée) pour ne pas perdre ce que l'utilisateur tape (ex: un "." en fin de saisie).
  const [text, setText] = useState(() => numericFieldValue(value));

  // Resynchronise si `value` change de l'extérieur, mais seulement si la valeur numérique a
  // réellement changé — même principe que AmountEditor (ne pas écraser une saisie en cours).
  useEffect(() => {
    const expected = numericFieldValue(value);
    const currentNumeric = Number(text.replace(',', '.')) || 0;
    const expectedNumeric = Number(expected) || 0;
    if (currentNumeric !== expectedNumeric) {
      setText(expected);
    }
  }, [value]);

  const handleTypeChange = (type: PaydayAmountType) => {
    if (type === value.type) return;
    const numeric = Number(text.replace(',', '.')) || 0;
    const next = withType(type, numeric);
    onChange(next);
    setText(numericFieldValue(next));
  };

  const handleTextChange = (raw: string) => {
    setText(raw);
    const numeric = Number(raw.replace(',', '.')) || 0;
    onChange(withType(value.type, numeric));
  };

  return (
    <View style={styles.container}>
      <View style={styles.chips}>
        {TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.chip, value.type === type && styles.chipSelected]}
            onPress={() => handleTypeChange(type)}
          >
            <Text style={[styles.chipText, value.type === type && styles.chipTextSelected]}>
              {TYPE_LABELS[type]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {value.type !== 'remainder' && (
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder={value.type === 'fixed' ? 'Montant en €' : 'Pourcentage'}
          value={text}
          onChangeText={handleTextChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
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
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
});
