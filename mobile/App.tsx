import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Pressable,
  SafeAreaView,
  Settings,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ReceiveScreen } from './src/screens/ReceiveScreen';
import { SendScreen } from './src/screens/SendScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MyScreen } from './src/screens/MyScreen';
import { useMembership } from './src/membership/useMembership';
import {
  clearPendingSharedFile,
  getPendingSharedFile,
} from './src/native/QRBeamNative';
import {
  preparePendingShare,
  type PreparedFile,
} from './src/transfer/fileSource';
import { colors } from './src/ui/theme';
import {
  applyLanguagePreference,
  normalizeLanguagePreference,
  t,
  userFacingError,
  type LanguagePreference,
} from './src/i18n';

type Tab = 'home' | 'receive' | 'send' | 'me';
const LANGUAGE_PREFERENCE_KEY = 'qrbeam.languagePreference';

function TabIcon({ kind, active }: { kind: Tab; active: boolean }) {
  if (kind === 'home') {
    return (
      <View style={[styles.homeIcon, active && styles.iconActive]}>
        <View style={[styles.homeDoor, active && styles.homeDoorActive]} />
      </View>
    );
  }
  if (kind === 'receive') {
    return (
      <View style={[styles.receiveIcon, active && styles.iconActive]}>
        <View style={[styles.receiveIconDot, active && styles.iconDotActive]} />
      </View>
    );
  }
  if (kind === 'send') {
    return (
      <View style={styles.sendIcon}>
        <View style={[styles.sendArrow, active && styles.sendArrowActive]} />
        <View style={[styles.sendTray, active && styles.iconActive]} />
      </View>
    );
  }
  return (
    <View style={styles.meIcon}>
      <View style={[styles.meHead, active && styles.meActive]} />
      <View style={[styles.meBody, active && styles.meActive]} />
    </View>
  );
}

function TabButton({
  label,
  kind,
  active,
  onPress,
}: {
  label: string;
  kind: Tab;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
    >
      <TabIcon kind={kind} active={active} />
      <Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text>
    </Pressable>
  );
}

export default function App(): React.JSX.Element {
  const [languagePreference, setLanguagePreference] =
    useState<LanguagePreference>(() => {
      const preference = normalizeLanguagePreference(
        Settings.get(LANGUAGE_PREFERENCE_KEY),
      );
      applyLanguagePreference(preference);
      return preference;
    });
  const [tab, setTab] = useState<Tab>('home');
  const [incomingFile, setIncomingFile] = useState<PreparedFile>();
  const [isPlaying, setIsPlaying] = useState(false);
  const checkingShare = useRef(false);
  const membership = useMembership();

  const changeLanguage = useCallback((preference: LanguagePreference) => {
    applyLanguagePreference(preference);
    Settings.set({ [LANGUAGE_PREFERENCE_KEY]: preference });
    setLanguagePreference(preference);
  }, []);

  const checkPendingShare = useCallback(async () => {
    if (checkingShare.current) return;
    checkingShare.current = true;
    try {
      const pending = await getPendingSharedFile();
      if (pending == null) return;
      const prepared = await preparePendingShare(pending);
      await clearPendingSharedFile(pending.id);
      setIncomingFile(prepared);
      setTab('send');
    } catch (error) {
      Alert.alert(t('app.sharedFileFailed'), userFacingError(error));
    } finally {
      checkingShare.current = false;
    }
  }, []);

  useEffect(() => {
    checkPendingShare().catch(() => undefined);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') checkPendingShare().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [checkPendingShare]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        {tab === 'home' ? (
          <HomeScreen />
        ) : tab === 'receive' ? (
          <ReceiveScreen
            isActive={!isPlaying}
            onMembershipChanged={membership.updateStatus}
            onUpgrade={() => setTab('me')}
          />
        ) : tab === 'send' ? (
          <SendScreen
            incomingFile={incomingFile}
            onPlayingChange={setIsPlaying}
            membership={membership.status}
            onMembershipChanged={membership.updateStatus}
            onUpgrade={() => setTab('me')}
          />
        ) : (
          <MyScreen
            membership={membership}
            languagePreference={languagePreference}
            onLanguageChange={changeLanguage}
          />
        )}
      </View>
      {!isPlaying && (
        <SafeAreaView style={styles.tabSafeArea}>
          <View style={styles.tabBar}>
            <TabButton
              label={t('tabs.home')}
              kind="home"
              active={tab === 'home'}
              onPress={() => setTab('home')}
            />
            <TabButton
              label={t('tabs.receive')}
              kind="receive"
              active={tab === 'receive'}
              onPress={() => setTab('receive')}
            />
            <TabButton
              label={t('tabs.send')}
              kind="send"
              active={tab === 'send'}
              onPress={() => setTab('send')}
            />
            <TabButton
              label={t('tabs.me')}
              kind="me"
              active={tab === 'me'}
              onPress={() => setTab('me')}
            />
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  tabSafeArea: {
    backgroundColor: '#0E1115',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tabBar: { height: 60, flexDirection: 'row', alignItems: 'center' },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  tabPressed: { opacity: 0.65 },
  tabLabel: { color: colors.textSubtle, fontSize: 11, fontWeight: '600' },
  tabActive: { color: colors.accent },
  homeIcon: {
    width: 19,
    height: 18,
    borderWidth: 1.8,
    borderColor: colors.textSubtle,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  homeDoor: {
    width: 5,
    height: 7,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: colors.textSubtle,
  },
  homeDoorActive: { borderColor: colors.accent },
  receiveIcon: {
    width: 21,
    height: 17,
    borderWidth: 1.8,
    borderColor: colors.textSubtle,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiveIconDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.textSubtle,
  },
  iconActive: { borderColor: colors.accent },
  iconDotActive: { backgroundColor: colors.accent },
  sendIcon: {
    width: 22,
    height: 18,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sendArrow: {
    width: 8,
    height: 8,
    borderTopWidth: 1.8,
    borderLeftWidth: 1.8,
    borderColor: colors.textSubtle,
    transform: [{ rotate: '45deg' }],
    position: 'absolute',
    top: 0,
  },
  sendArrowActive: { borderColor: colors.accent },
  sendTray: {
    width: 21,
    height: 9,
    borderWidth: 1.8,
    borderTopWidth: 0,
    borderColor: colors.textSubtle,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  meIcon: {
    width: 21,
    height: 19,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  meHead: {
    width: 7,
    height: 7,
    borderWidth: 1.8,
    borderColor: colors.textSubtle,
    borderRadius: 4,
    position: 'absolute',
    top: 0,
  },
  meBody: {
    width: 18,
    height: 9,
    borderWidth: 1.8,
    borderColor: colors.textSubtle,
    borderBottomWidth: 0,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
  meActive: { borderColor: colors.accent },
});
