import {
  applyLanguagePreference,
  normalizeLanguagePreference,
  normalizeLocale,
  t,
  translations,
  type SupportedLocale,
} from '../src/i18n';

const locales = Object.keys(translations) as SupportedLocale[];

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{([^}]+)\}/g)].map(match => match[1]).sort();
}

describe('localization catalogue', () => {
  test.each([
    ['zh-CN', 'zh-Hans'],
    ['en-US', 'en'],
    ['ja-JP', 'ja'],
    ['ko_KR', 'ko'],
    ['de-DE', 'de'],
    ['fr-FR', 'zh-Hans'],
  ] as const)('normalizes %s to %s', (input, expected) => {
    expect(normalizeLocale(input)).toBe(expected);
  });

  test('contains all five supported locales', () => {
    expect(locales.sort()).toEqual(['de', 'en', 'ja', 'ko', 'zh-Hans'].sort());
  });

  test('validates and applies a saved language preference', () => {
    expect(normalizeLanguagePreference('de')).toBe('de');
    expect(normalizeLanguagePreference('unsupported')).toBe('system');

    applyLanguagePreference('ja');
    expect(t('tabs.home')).toBe('ホーム');
    applyLanguagePreference('en');
    expect(t('tabs.home')).toBe('Home');
    applyLanguagePreference('system');
  });

  test('has no missing or blank strings', () => {
    const baseKeys = Object.keys(translations['zh-Hans']).sort();
    for (const currentLocale of locales) {
      expect(Object.keys(translations[currentLocale]).sort()).toEqual(baseKeys);
      for (const value of Object.values(translations[currentLocale])) {
        expect(value.trim()).not.toBe('');
      }
    }
  });

  test('keeps interpolation placeholders consistent', () => {
    for (const key of Object.keys(translations['zh-Hans']) as Array<
      keyof typeof translations['zh-Hans']
    >) {
      const expected = placeholders(translations['zh-Hans'][key]);
      for (const currentLocale of locales) {
        expect(placeholders(translations[currentLocale][key])).toEqual(expected);
      }
    }
  });

  test('uses a neutral action before the system camera permission prompt', () => {
    const expected = {
      'zh-Hans': '继续',
      en: 'Continue',
      ja: '続ける',
      ko: '계속',
      de: 'Weiter',
    } as const;

    for (const currentLocale of locales) {
      const label = translations[currentLocale]['receive.allowCamera'];
      expect(label).toBe(expected[currentLocale]);
      expect(label).not.toMatch(/allow|允许|許可|허용|erlauben/i);
    }
  });
});
