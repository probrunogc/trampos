import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';

export function AccountScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Conta</Text>
      <Text style={styles.sub}>Perfil e configurações (Etapa 4)</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgApp },
  title: { fontSize: 24, fontWeight: '900', color: colors.textPrimary },
  sub: { marginTop: 8, color: colors.textSecondary },
});
