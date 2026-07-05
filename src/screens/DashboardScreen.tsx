import { useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import type { MainStackParamList } from '@/navigation/RootNavigator';
import { useStore, type Expense } from '@/store/useStore';
import { confirmAction, errorMessage, notify } from '@/lib/alert';
import { formatAmount } from '@/lib/format';

type Props = NativeStackScreenProps<MainStackParamList, 'Dashboard'>;

export default function DashboardScreen({ navigation }: Props) {
  const profile = useStore((s) => s.profile);
  const partner = useStore((s) => s.partner);
  const expenses = useStore((s) => s.expenses);
  const balance = useStore(useShallow((s) => s.balance()));
  const settleUp = useStore((s) => s.settleUp);
  const refresh = useStore((s) => s.refresh);
  const signOut = useStore((s) => s.signOut);
  const [refreshing, setRefreshing] = useState(false);
  const [settling, setSettling] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleSettle = () => {
    if (!balance || balance.status === 'settled') return;
    const message =
      balance.status === 'owed_to_me'
        ? `Confirmer que ${partner?.displayName} t'a remboursé ${formatAmount(balance.amount)} ?`
        : `Confirmer que tu as remboursé ${formatAmount(balance.amount)} à ${partner?.displayName} ?`;

    confirmAction('Solder les comptes', message, async () => {
      setSettling(true);
      try {
        await settleUp();
      } catch (err) {
        notify('Erreur', errorMessage(err));
      } finally {
        setSettling(false);
      }
    });
  };

  const renderExpense = ({ item }: { item: Expense }) => {
    const payerName = item.payerId === profile?.id ? 'Toi' : partner?.displayName ?? 'Partenaire';
    return (
      <View style={styles.expenseRow}>
        <View>
          <Text style={styles.expenseLabel}>{item.label || item.category}</Text>
          <Text style={styles.expenseMeta}>
            {item.category} · payé par {payerName}
          </Text>
        </View>
        <Text style={styles.expenseAmount}>{formatAmount(item.amount)}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.balanceCard}>
        {balance?.status === 'settled' && <Text style={styles.balanceText}>Vous êtes à jour ✅</Text>}
        {balance?.status === 'owed_to_me' && (
          <Text style={styles.balanceText}>
            {partner?.displayName} te doit {formatAmount(balance.amount)}
          </Text>
        )}
        {balance?.status === 'i_owe' && (
          <Text style={styles.balanceText}>
            Tu dois {formatAmount(balance.amount)} à {partner?.displayName}
          </Text>
        )}
        {balance && balance.status !== 'settled' && (
          <TouchableOpacity style={styles.settleButton} onPress={handleSettle} disabled={settling}>
            <Text style={styles.settleButtonText}>{settling ? 'Solde en cours...' : 'Solder'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={renderExpense}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
        ListEmptyComponent={<Text style={styles.empty}>Aucune dépense pour l'instant.</Text>}
      />

      <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddExpense')}>
        <Text style={styles.addButtonText}>+ Ajouter une dépense</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.waterfallButton} onPress={() => navigation.navigate('Waterfall')}>
        <Text style={styles.waterfallButtonText}>📊 Budget (waterfall)</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => void signOut()} style={styles.signOut}>
        <Text style={styles.link}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  balanceCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  balanceText: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  settleButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  settleButtonText: { color: '#fff', fontWeight: '600' },
  list: { flexGrow: 1, paddingBottom: 8 },
  empty: { textAlign: 'center', color: '#999', marginTop: 32 },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  expenseLabel: { fontSize: 16, fontWeight: '600' },
  expenseMeta: { fontSize: 13, color: '#888', marginTop: 2 },
  expenseAmount: { fontSize: 16, fontWeight: '700' },
  addButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  waterfallButton: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  waterfallButtonText: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
  signOut: { marginTop: 16, marginBottom: 8 },
  link: { color: '#999', textAlign: 'center' },
});
