import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, AppState, SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {ReceiveScreen} from './src/screens/ReceiveScreen';
import {SendScreen} from './src/screens/SendScreen';
import {
  clearPendingSharedFile,
  getPendingSharedFile,
} from './src/native/QRBeamNative';
import {preparePendingShare, type PreparedFile} from './src/transfer/fileSource';

type Tab = 'receive' | 'send';

function TabButton({label, icon, active, onPress}: {label: string; icon: string; active: boolean; onPress: () => void}) {
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityState={{selected: active}} accessibilityLabel={label} onPress={onPress} style={styles.tab}>
      <Text style={[styles.tabIcon, active && styles.tabActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function App(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('receive');
  const [incomingFile, setIncomingFile] = useState<PreparedFile>();
  const [isPlaying, setIsPlaying] = useState(false);
  const checkingShare = useRef(false);

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
      Alert.alert('无法打开共享文件', String(error));
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
        {tab === 'receive' ? (
          <ReceiveScreen isActive={!isPlaying} />
        ) : (
          <SendScreen incomingFile={incomingFile} onPlayingChange={setIsPlaying} />
        )}
      </View>
      {!isPlaying && (
        <SafeAreaView style={styles.tabSafeArea}>
          <View accessibilityRole="tablist" style={styles.tabBar}>
            <TabButton label="电脑传手机" icon="▦" active={tab === 'receive'} onPress={() => setTab('receive')} />
            <TabButton label="手机传手机" icon="⇧" active={tab === 'send'} onPress={() => setTab('send')} />
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#090B10'},
  content: {flex: 1},
  tabSafeArea: {backgroundColor: '#0D1016', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2A303A'},
  tabBar: {height: 58, flexDirection: 'row', alignItems: 'center'},
  tab: {flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 3},
  tabIcon: {color: '#66707E', fontSize: 20, fontWeight: '700'},
  tabLabel: {color: '#66707E', fontSize: 11, fontWeight: '700'},
  tabActive: {color: '#67E8A5'},
});
