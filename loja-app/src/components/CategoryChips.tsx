import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors, spacing, radii, shadows } from '../constants/theme';
import { CATEGORIES } from '../constants/categories';
import { useData } from '../store/data';

interface Props {
  onPressCategory?: (catId: string) => void;
}

export function CategoryChips({ onPressCategory }: Props) {
  const products = useData((s) => s.products);
  const activeCats = CATEGORIES.filter((c) =>
    products.some((p) => p.category === c.id),
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}
    >
      {activeCats.map((c) => {
        const sample = products.find((p) => p.category === c.id && (p.image || p.images?.[0]));
        const img = sample?.image || sample?.images?.[0];

        return (
          <Pressable
            key={c.id}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            onPress={() => onPressCategory?.(c.id)}
            hitSlop={4}
          >
            <View style={styles.iconBox}>
              {img ? (
                <Image
                  source={{ uri: img }}
                  style={styles.iconImg}
                  contentFit="contain"
                  transition={200}
                />
              ) : (
                <Text style={styles.iconEmoji}>{c.emoji}</Text>
              )}
            </View>
            <Text style={styles.label} numberOfLines={1}>{c.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: 2,
    paddingBottom: spacing.sm,
    gap: 10,
  },
  chip: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    minWidth: 75,
  },
  chipPressed: { transform: [{ scale: 0.92 }] },
  iconBox: {
    width: 75,
    height: 75,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadows.sm,
  },
  iconImg: {
    width: '100%',
    height: '100%',
    padding: 9,
  },
  iconEmoji: { fontSize: 30 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.1,
  },
});
