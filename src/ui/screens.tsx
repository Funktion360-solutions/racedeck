// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashWidget } from '../model/layouts';
import { useStore } from '../model/store';
import { stateLabel, useTelemetry } from '../telemetry/hub';
import * as fmt from './format';
import { Grid } from './Grid';
import { PagesSheet, SettingsSheet, WidgetEditor, WidgetPicker } from './dialogs';
import { ACCENTS, ACCENT_NAMES, C, accentColor } from './theme';
import { ShiftLights } from './widgets';

const stateColor = (s: string) => (s === 'live' ? C.good : s === 'demo' ? C.cold : s === 'failed' ? C.hot : s === 'stopped' ? C.faint : C.warm);

function StatusPill() {
  const t = useTelemetry();
  const receiving = t.state === 'live' || t.state === 'demo' || t.state === 'paused';
  return (
    <View style={styles.pill}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: stateColor(t.state) }} />
      <Text style={{ color: C.text, fontSize: 11, fontWeight: '700' }}>{stateLabel[t.state]}</Text>
      {receiving ? <Text style={{ color: C.muted, fontSize: 10, fontVariant: ['tabular-nums'] }}>{t.packetsPerSecond}/s</Text> : null}
    </View>
  );
}

function Btn({ label, onPress, primary, active, accent }: { label: string; onPress: () => void; primary?: boolean; active?: boolean; accent: string }) {
  const filled = primary || active;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.btn, filled && { backgroundColor: accent, borderColor: accent }, pressed && { opacity: 0.75 }]}
    >
      <Text style={{ color: filled ? C.onAccent : C.text, fontWeight: primary ? '800' : '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

// ---------- Home ----------

export function HomeScreen({ onDrive }: { onDrive: () => void }) {
  const store = useStore();
  const t = useTelemetry();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const layout = store.selected;
  const accent = accentColor(layout.accent);
  const [editing, setEditing] = useState(false);
  const [editWidget, setEditWidget] = useState<DashWidget | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showPages, setShowPages] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const narrow = width < 760;

  return (
    <View style={[styles.screen, { paddingLeft: Math.max(16, insets.left), paddingRight: Math.max(16, insets.right), paddingTop: Math.max(6, insets.top), paddingBottom: Math.max(8, insets.bottom) }]}>
      <View style={styles.header}>
        <Text style={{ color: accent, fontSize: 26, fontWeight: '900', fontStyle: 'italic' }}>R</Text>
        {!narrow ? <Text style={{ color: C.text, fontSize: 19, fontWeight: '700', marginLeft: -4 }}>RaceDeck</Text> : null}
        <StatusPill />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 8, alignItems: 'center', flexGrow: 1, justifyContent: 'flex-end' }}>
          <Btn label={`${layout.name} ▾`} onPress={() => setShowPages(true)} accent={accent} />
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {ACCENTS.map((c, i) => (
              <Pressable key={c} onPress={() => store.updateLayout(layout.id, { accent: i })} accessibilityLabel={ACCENT_NAMES[i]} hitSlop={4}
                style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: i === layout.accent ? 1.5 : 0, borderColor: C.text }}>
                <View style={{ width: 15, height: 15, borderRadius: 8, backgroundColor: c }} />
              </Pressable>
            ))}
          </View>
          <Btn label={layout.style === 'racing' ? 'Stil: Racer' : 'Stil: Standard'} onPress={() => store.updateLayout(layout.id, { style: layout.style === 'racing' ? 'standard' : 'racing' })} accent={accent} />
          <Btn label={editing ? '✓ Færdig' : '✎ Rediger'} active={editing} onPress={() => setEditing((e) => !e)} accent={accent} />
          <Btn label="▶ Kør" primary onPress={() => { setEditing(false); onDrive(); }} accent={accent} />
        </ScrollView>
        <Pressable onPress={() => setShowSettings(true)} hitSlop={8} accessibilityLabel="Indstillinger" style={{ paddingHorizontal: 6 }}>
          <Text style={{ color: C.text, fontSize: 22 }}>⚙︎</Text>
        </Pressable>
      </View>

      {t.state === 'failed' || t.state === 'waiting' ? (
        <Pressable onPress={() => setShowSettings(true)} style={[styles.banner, { backgroundColor: t.state === 'failed' ? 'rgba(242,122,107,0.14)' : 'rgba(245,215,107,0.12)' }]}>
          <Text style={{ color: C.text, fontSize: 13, flex: 1 }}>
            {t.state === 'failed' ? t.error : `Venter på data fra ${store.settings.ps5Address}. Start GT7 på din PS5 – de skal være på samme Wi-Fi.`}
          </Text>
          <Text style={{ color: accent, fontWeight: '700', fontSize: 13 }}>Indstillinger</Text>
        </Pressable>
      ) : null}

      <Grid layout={layout} editing={editing} fill onEdit={setEditWidget} onAdd={() => setShowPicker(true)} />

      <WidgetEditor widget={editWidget} onClose={() => setEditWidget(null)} accent={accent} />
      <WidgetPicker visible={showPicker} onClose={() => setShowPicker(false)} accent={accent} />
      <PagesSheet visible={showPages} onClose={() => setShowPages(false)} accent={accent} />
      <SettingsSheet visible={showSettings} onClose={() => setShowSettings(false)} accent={accent} />
    </View>
  );
}

// ---------- Drive ----------

export function DriveScreen({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const t = useTelemetry();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const startIndex = Math.max(0, store.layouts.findIndex((l) => l.id === store.selectedId));
  const [page, setPage] = useState(startIndex);
  const [showHint, setShowHint] = useState(true);
  const scroller = useRef<ScrollView>(null);
  const pageWidth = width - Math.max(10, insets.left) - Math.max(10, insets.right);
  const layout = store.layouts[page] ?? store.selected;
  const accent = accentColor(layout.accent);
  const racing = layout.style === 'racing';

  useEffect(() => {
    if (store.settings.keepScreenOn) activateKeepAwakeAsync('drive').catch(() => {});
    const hint = setTimeout(() => setShowHint(false), 3500);
    return () => {
      deactivateKeepAwake('drive');
      clearTimeout(hint);
    };
  }, [store.settings.keepScreenOn]);

  useEffect(() => {
    // Jump to the selected page once the pager knows its width.
    requestAnimationFrame(() => scroller.current?.scrollTo({ x: startIndex * pageWidth, animated: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageWidth]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, pageWidth));
    if (p !== page) setPage(Math.max(0, Math.min(store.layouts.length - 1, p)));
  };

  const close = () => {
    if (store.layouts[page]) store.select(store.layouts[page].id);
    onClose();
  };

  return (
    <View style={[styles.drive, { paddingLeft: Math.max(10, insets.left), paddingRight: Math.max(10, insets.right), paddingTop: Math.max(6, insets.top), paddingBottom: Math.max(6, insets.bottom) }]}>
      <View style={styles.driveTop}>
        <Pressable onPress={close} accessibilityLabel="Afslut kørsel" hitSlop={8} style={styles.closeBtn}>
          <Text style={{ color: C.muted, fontWeight: '800' }}>✕</Text>
        </Pressable>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.state === 'live' || t.state === 'demo' ? C.good : t.state === 'paused' || t.state === 'waiting' ? C.warm : C.hot }} />
        <View style={{ flex: 1 }}>
          <ShiftLights f={t.frame} n={racing ? 18 : 24} accent={accent} racing={racing} flash={store.settings.shiftFlash} height={racing ? 14 : 10} />
        </View>
        <View style={{ flexDirection: 'row', gap: 5 }}>
          {store.layouts.map((l, i) => (
            <Pressable key={l.id} onPress={() => { setPage(i); scroller.current?.scrollTo({ x: i * pageWidth, animated: true }); }} hitSlop={6}
              style={{ width: i === page ? 14 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? accent : C.faint }} />
          ))}
        </View>
        <Text style={{ color: C.text, fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] }}>⏱ {fmt.clock(t.stats.sessionTime)}</Text>
      </View>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flex: 1 }}
      >
        {store.layouts.map((l, i) => (
          <View key={l.id} style={{ width: pageWidth, height: '100%' }}>
            {/* Only the visible page and its neighbours are drawn, to save battery. */}
            {Math.abs(i - page) <= 1 ? <Grid layout={l} fill gap={8} /> : null}
          </View>
        ))}
      </ScrollView>
      {showHint ? (
        <View style={styles.hint} pointerEvents="none">
          <Text style={{ color: C.muted, fontSize: 11 }}>Swipe for at skifte side</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border },
  btn: { height: 36, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, marginBottom: 8 },
  drive: { flex: 1, backgroundColor: '#050706', gap: 6 },
  driveTop: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 30 },
  closeBtn: { width: 34, height: 28, borderRadius: 14, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  hint: { position: 'absolute', bottom: 12, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
});
