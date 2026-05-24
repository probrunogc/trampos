import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, radii } from '../constants/theme';
import { useCart } from '../store/cart';

interface Props {
  address: string;
  onPressSearch?: () => void;
  onPressCart?: () => void;
}

export function AddressBar({ address, onPressSearch, onPressCart }: Props) {
  const count = useCart((s) => s.count());

  return (
    <View style={styles.container}>
      <Pressable style={styles.left} hitSlop={4}>
        <Feather name="map-pin" size={22} color={colors.yellow} />
        <View style={styles.textCol}>
          <Text style={styles.label}>Entregar em</Text>
          <Text style={styles.street} numberOfLines={1}>{address}</Text>
        </View>
        <Feather name="chevron-down" size={18} color={colors.textSecondary} style={{ opacity: 0.55 }} />
      </Pressable>
      <View style={styles.icons}>
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          onPress={onPressSearch}
          hitSlop={8}
        >
          <Feather name="search" size={22} color={colors.textPrimary} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          onPress={onPressCart}
          hitSlop={8}
        >
          <Feather name="shopping-cart" size={22} color={colors.textPrimary} />
          {count > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{count}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  textCol: { flex: 1, flexDirection: 'column' },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  street: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  icons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    position: 'relative',
  },
  pressed: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    transform: [{ scale: 0.9 }],
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.yellow,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textOnYellow,
  },
});
