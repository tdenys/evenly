import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '@/theme/colors';

export default function LoadingScreen() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
});
