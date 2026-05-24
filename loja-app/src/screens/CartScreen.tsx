import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { useCart } from '../store/cart';
import { brl } from '../utils/format';

export function CartScreen() {
  const items = useCart((s) => s.items);
  const total = useCart((s) => s.total());

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Carrinho</Text>
      {items.length === 0 ? (
        <Text style={styles.sub}>Vazio — Etapa 3 vai construir o checkout</Text>
      ) : (
        <>
          <Text style={styles.sub}>{items.length} item(s)</Text>
          <Text style={styles.total}>Total: {brl(total)}</Text>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgApp, padding: 20 },
  title: { fontSize: 24, fontWeight: '900', color: colors.textPrimary },
  sub: { marginTop: 8, color: colors.textSecondary, textAlign: 'center' },
  total: { marginTop: 16, fontSize: 20, fontWeight: '900', color: colors.purple700 },
});
