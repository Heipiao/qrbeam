import React, { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppButton } from '../components/AppButton';
import {
  formatLocalizedDate,
  t,
  userFacingError,
  type LanguagePreference,
} from '../i18n';
import type { MembershipController } from '../membership/useMembership';
import { isSubscriptionProductUnavailable } from '../membership/products';
import {
  SUBSCRIPTION_PRODUCT_IDS,
  type SubscriptionProduct,
} from '../native/QRBeamNative';
import { colors, radii, spacing } from '../ui/theme';

type LegalPage = 'privacy' | 'terms';

const languageOptions: ReadonlyArray<{
  value: Exclude<LanguagePreference, 'system'>;
  label: string;
}> = [
  { value: 'zh-Hans', label: '简体中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'de', label: 'Deutsch' },
];

function PlanCard({
  title,
  caption,
  fallbackPeriod,
  product,
  current,
  loading,
  unavailable,
  onPress,
}: {
  title: string;
  caption: string;
  fallbackPeriod: string;
  product?: SubscriptionProduct;
  current: boolean;
  loading: boolean;
  unavailable: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable || current }}
      disabled={unavailable || current || loading}
      onPress={onPress}
      style={[styles.plan, current && styles.planCurrent]}
    >
      <View style={styles.planText}>
        <View style={styles.planTitleRow}>
          <Text style={styles.planTitle}>{title}</Text>
          {current && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>{t('my.currentPlan')}</Text>
            </View>
          )}
        </View>
        <Text style={styles.planCaption}>{caption}</Text>
      </View>
      <View style={styles.planPriceBlock}>
        <Text style={styles.planPrice}>
          {loading ? t('my.processing') : product?.displayPrice ?? t('my.notAvailable')}
        </Text>
        <Text style={styles.planPeriod}>{fallbackPeriod}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function MyScreen({
  membership,
  languagePreference,
  onLanguageChange,
}: {
  membership: MembershipController;
  languagePreference: LanguagePreference;
  onLanguageChange: (preference: LanguagePreference) => void;
}): React.JSX.Element {
  const [legalPage, setLegalPage] = useState<LegalPage>();
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const expiration = formatLocalizedDate(membership.status?.expirationDate);
  const products = useMemo(
    () => new Map(membership.products.map(product => [product.id, product])),
    [membership.products],
  );

  const buy = async (productId: string) => {
    try {
      const result = await membership.purchase(productId);
      if (result.outcome === 'purchased') {
        Alert.alert(t('my.purchaseSuccessTitle'), t('my.purchaseSuccessMessage'));
      } else if (result.outcome === 'pending') {
        Alert.alert(t('my.purchasePendingTitle'), t('my.purchasePendingMessage'));
      }
    } catch (error) {
      Alert.alert(t('my.purchaseFailed'), userFacingError(error));
    }
  };

  const restore = async () => {
    try {
      const next = await membership.restore();
      Alert.alert(
        next.isPro ? t('my.restoredTitle') : t('my.noRestoreTitle'),
        next.isPro ? t('my.restoredMessage') : t('my.noRestoreMessage'),
      );
    } catch (error) {
      Alert.alert(t('my.restoreFailed'), userFacingError(error));
    }
  };

  const isPro = membership.status?.isPro === true;
  const currentProductId = membership.status?.productId;
  const productsUnavailable = !membership.productsLoading && membership.products.length === 0;
  const yearlyUnavailable = isSubscriptionProductUnavailable(
    membership.productsLoading,
    membership.products,
    SUBSCRIPTION_PRODUCT_IDS.yearly,
  );
  const monthlyUnavailable = isSubscriptionProductUnavailable(
    membership.productsLoading,
    membership.products,
    SUBSCRIPTION_PRODUCT_IDS.monthly,
  );
  const selectedLanguage =
    languagePreference === 'system'
      ? t('my.followSystem')
      : languageOptions.find(option => option.value === languagePreference)?.label ??
        t('my.followSystem');

  const selectLanguage = (preference: LanguagePreference) => {
    onLanguageChange(preference);
    setLanguagePickerVisible(false);
  };

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>{t('my.eyebrow')}</Text>
          <Text style={styles.title}>{t('my.title')}</Text>
        </View>

        <View style={[styles.statusCard, isPro && styles.proCard]}>
          <View style={styles.statusTop}>
            <View>
              <Text style={styles.statusLabel}>{t('my.currentStatus')}</Text>
              <Text style={styles.statusTitle}>
                {membership.loading ? t('my.checking') : isPro ? 'QRBeam Pro' : t('my.freeUser')}
              </Text>
            </View>
            <View style={[styles.statusBadge, isPro && styles.proBadge]}>
              <Text style={[styles.statusBadgeText, isPro && styles.proBadgeText]}>
                {isPro ? 'PRO' : 'FREE'}
              </Text>
            </View>
          </View>
          <Text style={styles.statusDescription}>
            {isPro
              ? t('my.proStatus')
              : t('my.freeStatus', {
                  count: membership.status?.freeSendsRemaining ?? '—',
                })}
          </Text>
          {isPro && expiration != null && (
            <Text style={styles.expiration}>
              {t('my.validUntil', { date: expiration })}
            </Text>
          )}
        </View>

        <View style={styles.comparison}>
          <View style={styles.comparisonColumn}>
            <Text style={styles.comparisonTitle}>{t('my.freePlan')}</Text>
            <Text style={styles.comparisonValue}>1 MiB</Text>
            <Text style={styles.comparisonCaption}>{t('my.dailyOne')}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.comparisonColumn}>
            <Text style={[styles.comparisonTitle, styles.proText]}>Pro</Text>
            <Text style={styles.comparisonValue}>5 MiB</Text>
            <Text style={styles.comparisonCaption}>{t('my.unlimited')}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('my.chooseSubscription')}</Text>
          <Text style={styles.sectionHint}>{t('my.securePayment')}</Text>
        </View>

        <View style={styles.plans}>
          <PlanCard
            title={t('my.yearly')}
            caption={t('my.yearlyCaption')}
            fallbackPeriod={t('my.perYear')}
            product={products.get(SUBSCRIPTION_PRODUCT_IDS.yearly)}
            current={currentProductId === SUBSCRIPTION_PRODUCT_IDS.yearly}
            loading={membership.actionProductId === SUBSCRIPTION_PRODUCT_IDS.yearly}
            unavailable={yearlyUnavailable || membership.actionProductId != null}
            onPress={() => buy(SUBSCRIPTION_PRODUCT_IDS.yearly)}
          />
          <PlanCard
            title={t('my.monthly')}
            caption={t('my.monthlyCaption')}
            fallbackPeriod={t('my.perMonth')}
            product={products.get(SUBSCRIPTION_PRODUCT_IDS.monthly)}
            current={currentProductId === SUBSCRIPTION_PRODUCT_IDS.monthly}
            loading={membership.actionProductId === SUBSCRIPTION_PRODUCT_IDS.monthly}
            unavailable={monthlyUnavailable || membership.actionProductId != null}
            onPress={() => buy(SUBSCRIPTION_PRODUCT_IDS.monthly)}
          />
        </View>

        {productsUnavailable && (
          <Text style={styles.storeNotice}>
            {t('my.storeUnavailable')}
          </Text>
        )}

        <View style={styles.accountActions}>
          <AppButton
            label={t('my.restore')}
            secondary
            loading={membership.restoring}
            disabled={membership.actionProductId != null}
            onPress={restore}
          />
          {isPro && (
            <Pressable
              accessibilityRole="link"
              onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
            >
              <Text style={styles.link}>{t('my.manageSubscription')}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('my.language')}</Text>
          <Text style={styles.sectionHint}>{t('my.languageHint')}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('my.language')}: ${selectedLanguage}`}
          onPress={() => setLanguagePickerVisible(true)}
          style={({ pressed }) => [
            styles.languageRow,
            pressed && styles.languageRowPressed,
          ]}
        >
          <View style={styles.languageIcon}>
            <Text style={styles.languageIconText}>Aa</Text>
          </View>
          <Text style={styles.languageValue}>{selectedLanguage}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Text style={styles.renewalCopy}>
          {t('my.renewal')}
        </Text>
        <View style={styles.legalLinks}>
          <Pressable onPress={() => setLegalPage('privacy')}>
            <Text style={styles.legalLink}>{t('my.privacyPolicy')}</Text>
          </Pressable>
          <Text style={styles.legalSeparator}>·</Text>
          <Pressable onPress={() => setLegalPage('terms')}>
            <Text style={styles.legalLink}>{t('my.subscriptionTerms')}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={languagePickerVisible}
        onRequestClose={() => setLanguagePickerVisible(false)}
      >
        <SafeAreaView style={styles.legalPage}>
          <View style={styles.legalHeader}>
            <Text style={styles.legalTitle}>{t('my.language')}</Text>
            <Pressable onPress={() => setLanguagePickerVisible(false)}>
              <Text style={styles.close}>{t('common.done')}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.languageList}>
            {[
              { value: 'system' as const, label: t('my.followSystem') },
              ...languageOptions,
            ].map(option => {
              const selected = option.value === languagePreference;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={option.value}
                  onPress={() => selectLanguage(option.value)}
                  style={({ pressed }) => [
                    styles.languageOption,
                    selected && styles.languageOptionSelected,
                    pressed && styles.languageRowPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.languageOptionText,
                      selected && styles.languageOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        animationType="slide"
        presentationStyle="pageSheet"
        visible={legalPage != null}
        onRequestClose={() => setLegalPage(undefined)}
      >
        <SafeAreaView style={styles.legalPage}>
          <View style={styles.legalHeader}>
            <Text style={styles.legalTitle}>
              {legalPage === 'privacy'
                ? t('my.privacyPolicy')
                : t('my.subscriptionTerms')}
            </Text>
            <Pressable onPress={() => setLegalPage(undefined)}>
              <Text style={styles.close}>{t('common.done')}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.legalContent}>
            {legalPage === 'privacy' ? (
              <Text style={styles.legalBody}>
                {t('my.privacyBody')}
              </Text>
            ) : (
              <Text style={styles.legalBody}>
                {t('my.termsBody')}
              </Text>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.large,
    paddingTop: 28,
    paddingBottom: 34,
  },
  intro: { marginBottom: 22 },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginTop: 7,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.large,
    padding: 20,
  },
  proCard: { borderColor: colors.accent, backgroundColor: colors.accentSurface },
  statusTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  statusLabel: { color: colors.textSubtle, fontSize: 12, fontWeight: '600' },
  statusTitle: { color: colors.text, fontSize: 24, fontWeight: '700', marginTop: 5 },
  statusBadge: {
    borderRadius: radii.round,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  proBadge: { backgroundColor: colors.accent },
  statusBadgeText: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
  proBadgeText: { color: colors.ink },
  statusDescription: { color: colors.textMuted, fontSize: 14, marginTop: 18 },
  expiration: { color: colors.textSubtle, fontSize: 11, marginTop: 8 },
  comparison: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 14,
    paddingVertical: 18,
  },
  comparisonColumn: { flex: 1, alignItems: 'center', gap: 5 },
  divider: { width: 1, backgroundColor: colors.border },
  comparisonTitle: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  proText: { color: colors.accent },
  comparisonValue: { color: colors.text, fontSize: 20, fontWeight: '700' },
  comparisonCaption: { color: colors.textSubtle, fontSize: 11 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 30,
    marginBottom: 12,
  },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  sectionHint: { color: colors.textSubtle, fontSize: 10 },
  plans: { gap: 10 },
  plan: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  planCurrent: { borderColor: colors.accent },
  planText: { flex: 1 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  planCaption: { color: colors.textSubtle, fontSize: 11, marginTop: 6 },
  currentBadge: {
    backgroundColor: colors.accentSurface,
    borderRadius: radii.round,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  currentBadgeText: { color: colors.accent, fontSize: 9, fontWeight: '700' },
  planPriceBlock: { alignItems: 'flex-end' },
  planPrice: { color: colors.text, fontSize: 15, fontWeight: '700' },
  planPeriod: { color: colors.textSubtle, fontSize: 10, marginTop: 4 },
  storeNotice: { color: colors.danger, fontSize: 12, lineHeight: 18, marginTop: 10 },
  accountActions: { marginTop: 20, gap: 16 },
  link: { color: colors.accent, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  languageRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.medium,
    paddingHorizontal: 16,
  },
  languageRowPressed: { opacity: 0.65 },
  languageIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: colors.accentSurface,
  },
  languageIconText: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  languageValue: { flex: 1, color: colors.text, fontSize: 15, marginLeft: 12 },
  chevron: { color: colors.textSubtle, fontSize: 26, fontWeight: '300' },
  renewalCopy: {
    color: colors.textSubtle,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 22,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  legalLink: { color: colors.textMuted, fontSize: 11, textDecorationLine: 'underline' },
  legalSeparator: { color: colors.textSubtle },
  legalPage: { flex: 1, backgroundColor: colors.background },
  legalHeader: {
    minHeight: 58,
    paddingHorizontal: spacing.large,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  legalTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  close: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  legalContent: { padding: spacing.large },
  legalBody: { color: colors.textMuted, fontSize: 15, lineHeight: 25 },
  languageList: { padding: spacing.large, gap: 10 },
  languageOption: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.medium,
    paddingHorizontal: 18,
  },
  languageOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  languageOptionText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  languageOptionTextSelected: { color: colors.accent },
  checkmark: { color: colors.accent, fontSize: 18, fontWeight: '800' },
});
