import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '@/store/useStore';
import { errorMessage, notify } from '@/lib/alert';
import { colors, ink, withOpacity } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import Button from '@/components/ui/Button';

function parseIncome(text: string): number | null {
  const parsed = Number(text.replace(',', '.'));
  return Number.isNaN(parsed) || parsed < 0 ? null : parsed;
}

interface NameFieldProps {
  label: string;
  displayName: string;
  accent: string;
  onSave: (displayName: string) => Promise<void>;
}

/** Le prénom affiché pour une personne — même principe que IncomeField : éditable depuis
 * n'importe quel compte (voir updatePartnerDisplayName), resynchronisé si l'autre appareil le
 * modifie entre-temps. */
function NameField({ label, displayName, accent, onSave }: NameFieldProps) {
  const [text, setText] = useState(displayName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (text !== displayName) setText(displayName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayName]);

  const handleSave = async () => {
    const trimmed = text.trim();
    if (trimmed === '') {
      notify('Prénom invalide', 'Renseigne un prénom.');
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      notify('Enregistré', 'Le prénom a été mis à jour.');
    } catch (err) {
      notify('Erreur', errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: withOpacity(accent, 0.1), borderColor: withOpacity(accent, 0.2) }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <TextInput style={styles.input} value={text} onChangeText={setText} autoCapitalize="words" />
      <Button
        title={saving ? 'Enregistrement...' : 'Enregistrer'}
        onPress={() => void handleSave()}
        disabled={saving}
        compact
        color={accent}
      />
    </View>
  );
}

interface IncomeFieldProps {
  label: string;
  netIncome: number;
  accent: string;
  onSave: (netIncome: number) => Promise<void>;
}

/** Un salaire éditable — même formulaire pour "mon" revenu et celui du/de la partenaire, les
 * deux étant maintenant modifiables depuis n'importe quel compte. Teinté à l'accent de la
 * personne pour suivre le pattern "Duo bicolore" (jamais "moi"/"partenaire" en couleur, mais
 * Accent A/B, stable). */
function IncomeField({ label, netIncome, accent, onSave }: IncomeFieldProps) {
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
    <View style={[styles.card, { backgroundColor: withOpacity(accent, 0.1), borderColor: withOpacity(accent, 0.2) }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <TextInput style={styles.input} keyboardType="decimal-pad" value={text} onChangeText={setText} />
      <Button
        title={saving ? 'Enregistrement...' : 'Enregistrer'}
        onPress={() => void handleSave()}
        disabled={saving}
        compact
        color={accent}
      />
    </View>
  );
}

export default function IncomeScreen() {
  const profile = useStore((s) => s.profile);
  const partner = useStore((s) => s.partner);
  const updateMyDisplayName = useStore((s) => s.updateMyDisplayName);
  const updatePartnerDisplayName = useStore((s) => s.updatePartnerDisplayName);
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
      <NameField
        label="Mon prénom"
        displayName={profile?.displayName ?? ''}
        accent={colors.accentA}
        onSave={updateMyDisplayName}
      />
      <IncomeField
        label="Mon revenu net"
        netIncome={profile?.netIncome ?? 0}
        accent={colors.accentA}
        onSave={updateMyIncome}
      />
      <NameField
        label={`Prénom de ${partner?.displayName ?? 'ton/ta partenaire'}`}
        displayName={partner?.displayName ?? ''}
        accent={colors.accentB}
        onSave={updatePartnerDisplayName}
      />
      <IncomeField
        label={`Revenu de ${partner?.displayName ?? 'ton/ta partenaire'}`}
        netIncome={partner?.netIncome ?? 0}
        accent={colors.accentB}
        onSave={updatePartnerIncome}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16, gap: 14 },
  card: { borderRadius: 16, borderWidth: 1.5, padding: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontFamily: fonts.karlaBold, fontSize: 13, color: ink(0.65) },
  input: {
    borderWidth: 1.5,
    borderColor: colors.borderInput,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 12,
    fontFamily: fonts.spectralSemiBold,
    fontSize: 20,
    color: colors.ink,
  },
});
