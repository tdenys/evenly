import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/theme/colors';

interface Props {
  /** 0-100, jamais négatif ni > 100 côté rendu (clampé ici, pas à l'appelant). */
  pct: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
}

/** Anneau de progression générique (SVG) — départ à midi, sens horaire. Le contenu (ex: "2/3")
 * est superposé au centre via `children`, pas un texte imposé par le composant. */
export default function ProgressRing({
  pct,
  size = 64,
  strokeWidth = 7,
  color = colors.primary,
  trackColor = colors.borderInput,
  children,
}: Props) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          strokeLinecap="round"
          rotation="-90"
          origin={`${center}, ${center}`}
        />
      </Svg>
      {children}
    </View>
  );
}
