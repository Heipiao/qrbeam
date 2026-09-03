import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radii, spacing } from '../ui/theme';
import { t } from '../i18n';

function Command({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.commandGroup}>
      <Text style={styles.commandLabel}>{label}</Text>
      <View style={styles.commandBox}>
        <Text selectable style={styles.command}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export function HomeScreen(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.page}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.mark}>
            <View style={styles.markCore} />
          </View>
          <Text style={styles.brand}>QRBeam</Text>
          <Text style={styles.title}>{t('home.title')}</Text>
          <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('home.installCli')}</Text>
          <Command label="Python" value="pip install qrbeam" />
          <Command label="Node.js" value="npm install -g qrbeam" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('home.sendFile')}</Text>
          <Command label="Terminal" value="qrbeam send FILE" />
        </View>

        <Text style={styles.note}>{t('home.note')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.large,
    paddingTop: 34,
    paddingBottom: 30,
  },
  header: { marginBottom: 38 },
  mark: {
    width: 38,
    height: 38,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  markCore: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  brand: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.7,
    marginTop: 7,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  section: { marginBottom: 28, gap: 12 },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  commandGroup: { gap: 7 },
  commandLabel: { color: colors.textSubtle, fontSize: 12, fontWeight: '600' },
  commandBox: {
    minHeight: 52,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.medium,
    paddingHorizontal: spacing.medium,
  },
  command: { color: colors.text, fontFamily: 'Menlo', fontSize: 13 },
  note: { color: colors.textSubtle, fontSize: 12, lineHeight: 18 },
});
