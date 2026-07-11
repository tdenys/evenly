import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'text-danger';
  /** Override de couleur (ex: Accent A/B pour un CTA propre à une personne) — ignoré pour
   * text-danger, qui reste toujours dans la couleur d'alerte. */
  color?: string;
  compact?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  color,
  compact = false,
  disabled = false,
  icon,
}: Props) {
  const tint = color ?? colors.primary;

  if (variant === 'text-danger') {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled} style={styles.textDanger}>
        <Text style={[styles.textDangerLabel, disabled && styles.disabledText]}>{title}</Text>
      </TouchableOpacity>
    );
  }

  const isOutline = variant === 'outline';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.base,
        compact && styles.compact,
        isOutline
          ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: tint }
          : { backgroundColor: tint },
        disabled && styles.disabled,
      ]}
    >
      {icon}
      <Text style={[styles.label, { color: isOutline ? tint : '#fff' }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  compact: { height: 44 },
  disabled: { opacity: 0.5 },
  label: { fontFamily: fonts.karlaBold, fontSize: 14.5 },
  textDanger: { paddingVertical: 10, alignItems: 'center' },
  textDangerLabel: { fontFamily: fonts.karlaBold, fontSize: 13.5, color: colors.danger },
  disabledText: { opacity: 0.5 },
});
