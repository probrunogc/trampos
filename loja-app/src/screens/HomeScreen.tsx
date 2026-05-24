import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AddressBar } from '../components/AddressBar';
import { BannerCarousel } from '../components/BannerCarousel';
import { CategoryChips } from '../components/CategoryChips';
import { ProductCard } from '../components/ProductCard';
import { colors, spacing } from '../constants/theme';
import { useData } from '../store/data';
import type { Product } from '../types';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../navigation/types';

type Props = BottomTabScreenProps<TabParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { products, banners, settings, loading, loadAll } = useData();

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const address = settings.lojaAddress || settings.address || 'Rua das Bebidas, 123';

  // Para o grid 4 colunas, agrupar produtos em pares de 4
  const featured = products.slice(0, 12); // 3 linhas de 4 = 12

  const rows: Product[][] = [];
  for (let i = 0; i < featured.length; i += 4) {
    rows.push(featured.slice(i, i + 4));
  }

  const handleProductPress = (_p: Product) => {
    // TODO: navigate to product detail (Etapa 2)
  };

  const handleCategoryPress = (catId: string) => {
    navigation.navigate('Categories');
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <StatusBar style="dark" />
      <AddressBar
        address={address}
        onPressSearch={() => navigation.navigate('Categories')}
        onPressCart={() => navigation.navigate('Cart')}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadAll}
            tintColor={colors.purple500}
          />
        }
      >
        <BannerCarousel banners={banners} />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>CATEGORIAS</Text>
          <Text
            style={styles.seeAll}
            onPress={() => navigation.navigate('Categories')}
          >
            Ver todas →
          </Text>
        </View>
        <CategoryChips onPressCategory={handleCategoryPress} />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>DESTAQUES</Text>
          <Text style={styles.seeAll}>Ver todos</Text>
        </View>

        {loading && products.length === 0 ? (
          <ActivityIndicator color={colors.purple500} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.grid}>
            {rows.map((row, rowIdx) => (
              <View key={rowIdx} style={styles.row}>
                {row.map((p) => (
                  <ProductCard key={p.id} product={p} onPress={handleProductPress} />
                ))}
                {/* preenche slots vazios para alinhar */}
                {row.length < 4 &&
                  Array.from({ length: 4 - row.length }).map((_, i) => (
                    <View key={`empty-${i}`} style={{ flex: 1 }} />
                  ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgApp },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textPrimary,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.purple500,
    letterSpacing: 0.1,
  },
  grid: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
});
