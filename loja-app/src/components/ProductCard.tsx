import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, radii, shadows, typography } from '../constants/theme';
import { brl, firstProductImage } from '../utils/format';
import { useCart } from '../store/cart';
import type { Product } from '../types';

interface Props {
  product: Product;
  onPress?: (p: Product) => void;
}

export function ProductCard({ product, onPress }: Props) {
  const add = useCart((s) => s.add);
  const img = firstProductImage(product);

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    add(product, 1);
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress?.(product)}
    >
      <View style={styles.imgBox}>
        {img ? (
          <Image
            source={{ uri: img }}
            style={styles.img}
            contentFit="contain"
            transition={250}
          />
        ) : (
          <Text style={styles.placeholder}>🍺</Text>
        )}
      </View>

      <View style={styles.body}>
        <Text style={[typography.cardName, styles.name]} numberOfLines={2}>
          {product.name}
        </Text>
        {product.brand && (
          <Text style={[typography.cardBrand, styles.brand]} numberOfLines={1}>
            {product.brand}
          </Text>
        )}

        <View style={styles.footer}>
          <Text style={typography.cardPrice} numberOfLines={1}>
            {brl(product.price)}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
            onPress={handleAdd}
            hitSlop={6}
          >
            <Feather name="plus" size={16} color={colors.textOnYellow} strokeWidth={3} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.09)',
    overflow: 'hidden',
    ...shadows.sm,
  },
  cardPressed: { transform: [{ scale: 0.95 }] },
  imgBox: {
    width: '100%',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  img: { width: '100%', height: '100%' },
  placeholder: { fontSize: 38 },
  body: {
    padding: 7,
    paddingBottom: 8,
    flexDirection: 'column',
    flex: 1,
  },
  name: { flex: 1 },
  brand: { marginTop: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 2,
  },
  addBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.yellow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 7,
    elevation: 3,
  },
  addBtnPressed: { transform: [{ scale: 0.85 }] },
});
