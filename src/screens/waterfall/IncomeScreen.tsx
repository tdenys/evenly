import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '@/store/useStore';
import { errorMessage, notify } from '@/lib/alert';

function parseIncome(text: string): number | null {
  const parsed = Number(text.replace(',', '.'));
  return Number.isNaN(parsed) || parsed < 0 ? null : parsed;
}

interface IncomeFieldProps {
  label: string;
  netIncome: number;
  onSave: (netIncome: number) => Promise<void>;
}

/** Un salaire éditable — même formulaire pour "mon" revenu et celui du/de la partenaire, les
 * deux étant maintenant modifiables depuis n'importe quel compte. */
function IncomeField({ label, netIncome, onSave }: IncomeFieldProps) {
  const [text, setText] = useState(String(netIncome));
  const [saving, setSaving] = useState(false);

  // Resynchronise si `netIncome` change de l'extérieur (l'autre appareil vient de le modifier,
  // ou refresh() ramène une valeur plus fraîche) — mais seulement si la valeur numérique a
  // réellement changé, pour ne pas écraser une saisie en cours (même principe que AmountEditor).
  useEffect(() => {
    const currentNumeric = parseIncome(text) ?? 0;
    if (currentNumeric !== netIncome) {
      setText(String(netIncome));
    }
  }, [netIncome]);

  const handleSave = async () => {
    const parsed = parseIncome(text);
    if (parsed === null) {
      notify('Montant invalide', 'Renseigne un revenu net valide.');
      return;
    }
    setSaving(true);
    try {
      await onSave(parsed);
      notify('Enregistré', 'Le revenu net a été mis à jour.');
    } catch (err) {
      notify('Erreur', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={text} onChangeText={setText} />
      <TouchableOpacity style={styles.button} onPress={() => void handleSave()} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function IncomeScreen() {
  const profile = useStore((s) => s.profile);
  const partner = useStore((s) => s.partner);
  const updateMyIncome = useStore((s) => s.updateMyIncome);
  const updatePartnerIncome = useStore((s) => s.updatePartnerIncome);
  const refresh = useStore((s) => s.refresh);

  // S'assure que les revenus affichés ne sont pas périmés — voir le commentaire équivalent dans
  // WaterfallScreen sur pourquoi useFocusEffect et pas useEffect.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  return (
    <View style={styles.container}>
      <IncomeField label="Mon revenu net" netIncome={profile?.netIncome ?? 0} onSave={updateMyIncome} />
      <IncomeField
        label={`Revenu de ${partner?.displayName ?? 'ton/ta partenaire'}`}
        netIncome={partner?.netIncome ?? 0}
        onSave={updatePartnerIncome}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 20,
    fontWeight: '700',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
