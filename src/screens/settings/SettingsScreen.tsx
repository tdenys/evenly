import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { useStore } from '@/store/useStore';
import { confirmAction, errorMessage, notify } from '@/lib/alert';
import { checkAndApplyUpdate, getCurrentUpdateInfo } from '@/lib/updates';
import { colors, ink, withOpacity } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import Button from '@/components/ui/Button';

interface NameFieldProps {
  label: string;
  displayName: string;
  accent: string;
  onSave: (displayName: string) => Promise<void>;
}

/** Le prénom affiché pour une personne, éditable depuis n'importe quel compte (voir
 * updatePartnerDisplayName), resynchronisé si l'autre appareil le modifie entre-temps. */
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

function describeUpdateStatus(): string {
  const info = getCurrentUpdateInfo();
  if (!info) return 'Version de développement';
  if (info.isEmbeddedLaunch || !info.createdAt) return 'Version installée (dernier build)';
  return `Mise à jour du ${info.createdAt.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function UpdateSection() {
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const result = await checkAndApplyUpdate();
      // 'updated' n'est en pratique jamais lu ici : checkAndApplyUpdate() redémarre l'app
      // (reloadAsync) avant que cette ligne ne s'exécute si une mise à jour est trouvée.
      if (result === 'up-to-date') {
        notify('À jour', "Tu as déjà la dernière version.");
      } else if (result === 'unavailable') {
        notify('Indisponible', "Les mises à jour ne sont pas disponibles ici (version de développement).");
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.label}>Mises à jour</Text>
      </View>
      <Text style={styles.updateStatus}>{describeUpdateStatus()}</Text>
      <Button
        title={checking ? 'Vérification...' : 'Vérifier les mises à jour'}
        onPress={() => void handleCheck()}
        disabled={checking}
        variant="outline"
        compact
      />
    </View>
  );
}

function AccountsSection() {
  const accounts = useStore((s) => s.accounts);
  const loadAccounts = useStore((s) => s.loadAccounts);
  const createAccount = useStore((s) => s.createAccount);
  const deleteAccount = useStore((s) => s.deleteAccount);
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const handleAdd = async () => {
    const trimmed = newLabel.trim();
    if (trimmed === '') return;
    setAdding(true);
    try {
      await createAccount(trimmed);
      setNewLabel('');
    } catch (err) {
      notify('Erreur', errorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = (id: string, label: string) => {
    confirmAction('Supprimer le compte', `Supprimer "${label}" ?`, async () => {
      try {
        await deleteAccount(id);
      } catch (err) {
        notify('Erreur', errorMessage(err));
      }
    });
  };

  return (
    <View style={styles.card}>
      {accounts.map((acc) => (
        <View key={acc.id} style={styles.accountRow}>
          <Text style={styles.accountLabel} numberOfLines={1}>
            {acc.label}
          </Text>
          <TouchableOpacity onPress={() => handleDelete(acc.id, acc.label)} hitSlop={8}>
            <Trash2 size={17} color={colors.danger} />
          </TouchableOpacity>
        </View>
      ))}
      <View style={styles.accountAddRow}>
        <TextInput
          style={[styles.input, styles.accountInput]}
          placeholder="Ex : Compte commun Fortuneo"
          value={newLabel}
          onChangeText={setNewLabel}
        />
        <Button title="Ajouter" onPress={() => void handleAdd()} disabled={adding || newLabel.trim() === ''} compact />
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const profile = useStore((s) => s.profile);
  const partner = useStore((s) => s.partner);
  const updateMyDisplayName = useStore((s) => s.updateMyDisplayName);
  const updatePartnerDisplayName = useStore((s) => s.updatePartnerDisplayName);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionLabel text="Prénoms" />
      <NameField
        label="Mon prénom"
        displayName={profile?.displayName ?? ''}
        accent={colors.accentA}
        onSave={updateMyDisplayName}
      />
      <NameField
        label={`Prénom de ${partner?.displayName ?? 'ton/ta partenaire'}`}
        displayName={partner?.displayName ?? ''}
        accent={colors.accentB}
        onSave={updatePartnerDisplayName}
      />

      <SectionLabel text="Comptes" />
      <AccountsSection />

      <SectionLabel text="Application" />
      <UpdateSection />
    </ScrollView>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.sectionLabel}>{text}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 14, paddingBottom: 48 },
  sectionLabel: {
    fontFamily: fonts.karlaBold,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: ink(0.42),
  },
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.section,
    padding: 16,
    gap: 12,
  },
  updateStatus: { fontFamily: fonts.karlaMedium, fontSize: 13, color: ink(0.55) },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  accountLabel: { fontFamily: fonts.karlaMedium, fontSize: 14, color: colors.ink, flex: 1, marginRight: 8 },
  accountAddRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  accountInput: { flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontFamily: fonts.karlaBold, fontSize: 13, color: ink(0.65) },
  input: {
    borderWidth: 1.5,
    borderColor: colors.borderInput,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 12,
    fontFamily: fonts.karlaMedium,
    fontSize: 16,
    color: colors.ink,
  },
});
