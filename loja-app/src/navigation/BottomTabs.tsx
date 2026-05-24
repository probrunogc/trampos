import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { HomeScreen } from '../screens/HomeScreen';
import { CategoriesScreen } from '../screens/CategoriesScreen';
import { CartScreen } from '../screens/CartScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { useCart } from '../store/cart';
import { colors } from '../constants/theme';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

const TABS: Array<{
  name: keyof TabParamList;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}> = [
  { name: 'Home',       label: 'Início',     icon: 'home' },
  { name: 'Categories', label: 'Categorias', icon: 'grid' },
  { name: 'Cart',       label: 'Carrinho',   icon: 'shopping-cart' },
  { name: 'Orders',     label: 'Pedidos',    icon: 'clipboard' },
  { name: 'Account',    label: 'Conta',      icon: 'user' },
];

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const cartCount = useCart((s) => s.count());

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, 8) },
      ]}
    >
      {TABS.map((tab, i) => {
        const isFocused = state.index === i;
        const isCart = tab.name === 'Cart';

        const onPress = () => {
          Haptics.selectionAsync();
          const event = navigation.emit({
            type: 'tabPress',
            target: state.routes[i].key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(tab.name);
          }
        };

        return (
          <Pressable
            key={tab.name}
            onPress={onPress}
            style={({ pressed }) => [
              styles.tab,
              pressed && { transform: [{ scale: 0.92 }] },
            ]}
            hitSlop={4}
          >
            <View style={styles.iconWrap}>
              <Feather
                name={tab.icon}
                size={22}
                color={isFocused ? colors.purple500 : 'rgba(0,0,0,0.30)'}
              />
              {isCart && cartCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, isFocused && styles.labelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function BottomTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"       component={HomeScreen} />
      <Tab.Screen name="Categories" component={CategoriesScreen} />
      <Tab.Screen name="Cart"       component={CartScreen} />
      <Tab.Screen name="Orders"     component={OrdersScreen} />
      <Tab.Screen name="Account"    component={AccountScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.07,
        shadowRadius: 20,
      },
      android: { elevation: 12 },
    }),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 4,
  },
  iconWrap: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.yellow,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textOnYellow,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.30)',
    letterSpacing: 0.1,
  },
  labelActive: {
    color: colors.purple500,
    fontWeight: '800',
  },
});
