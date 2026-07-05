import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { Amount } from '@/core/waterfall/types';

interface Props {
  value: Amount;
  onChange: (amount: Amount) => void;
}

type AmountType = Amount['type'];

const TYPE_LABELS: Record<AmountType, string> = {
  fixed: 'Montant fixe',
  percent_envelope: '% du revenu',
  percent_remaining: '% du reste',
  prorata_income: 'Prorata revenus',
};

const TYPES: AmountType[] = ['fixed', 'percent_envelope', 'percent_remaining', 'prorata_income'];

function numericFieldValue(amount: Amount): string {
  if (amount.type === 'fixed') return String(amount.value);
  if (amount.type === 'percent_envelope' || amount.type === 'percent_remaining') return String(amount.pct);
  return '';
}

function withType(type: AmountType, numericValue: number): Amount {
  switch (type) {
    case 'fixed':
      return { type: 'fixed', value: numericValue };
    case 'percent_envelope':
      return { type: 'percent_envelope', pct: numericValue };
    case 'percent_remaining':
      return { type: 'percent_remaining', pct: numericValue };
    case 'prorata_income':
      return { type: 'prorata_income' };
  }
}

export default function AmountEditor({ value, onChange }: Props) {
  // Le texte brut est la source de vérité pour l'affichage (pas la valeur numérique déjà
  // parsée) pour ne pas perdre ce que l'utilisateur tape (ex: un "." en fin de saisie).
  const [text, setText] = useState(() => numericFieldValue(value));

  const handleTypeChange = (type: AmountType) => {
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

      {value.type !== 'prorata_income' && (
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
