import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  FlatList,
  Pressable,
  StyleSheet,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { colors, radii, spacing } from '../constants/theme';
import type { Banner } from '../types';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PADDING = spacing.lg;
const SLIDE_WIDTH = SCREEN_W - H_PADDING * 2;

interface Props {
  banners: Banner[];
  onPressBanner?: (b: Banner) => void;
}

export function BannerCarousel({ banners, onPressBanner }: Props) {
  const [index, setIndex] = useState(0);
  const ref = useRef<FlatList>(null);

  // Auto-advance a cada 5s
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => {
      const next = (index + 1) % banners.length;
      ref.current?.scrollToIndex({ index: next, animated: true });
      setIndex(next);
    }, 5000);
    return () => clearInterval(t);
  }, [index, banners.length]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / (SLIDE_WIDTH + spacing.md));
    if (next !== index) setIndex(next);
  };

  if (banners.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        ref={ref}
        data={banners}
        keyExtractor={(b) => b.id}
        horizontal
        pagingEnabled
        snapToInterval={SLIDE_WIDTH + spacing.md}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: H_PADDING, gap: spacing.md }}
        onMomentumScrollEnd={onScroll}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.slide,
              { width: SLIDE_WIDTH },
              pressed && { transform: [{ scale: 0.975 }] },
            ]}
            onPress={() => onPressBanner?.(item)}
          >
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.image}
              contentFit="cover"
              transition={200}
            />
          </Pressable>
        )}
      />

      {banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === index && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: spacing.sm },
  slide: {
    aspectRatio: 16 / 7,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.purple800,
  },
  image: { width: '100%', height: '100%' },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginTop: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  dotActive: {
    backgroundColor: colors.purple500,
    width: 20,
  },
});
