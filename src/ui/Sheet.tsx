// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { C } from './theme';

/** A centred dialog that works in landscape (iOS needs supportedOrientations). */
export function Sheet({ visible, title, onClose, closeLabel = 'Færdig', accent, children }: {
  visible: boolean;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" supportedOrientations={['landscape-left', 'landscape-right']} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Luk">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
              <Text style={{ color: accent, fontWeight: '700', fontSize: 15 }}>{closeLabel}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function Section({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Note({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.note, style]}>{children}</Text>;
}

export function ListButton({ label, detail, icon, onPress, danger, accent }: { label: string; detail?: string; icon: string; onPress: () => void; danger?: boolean; accent: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, { justifyContent: 'flex-start', gap: 12, opacity: pressed ? 0.7 : 1 }]}>
      <Text style={{ width: 22, textAlign: 'center', color: danger ? C.hot : accent, fontWeight: '800', fontSize: 15 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? C.hot : C.text, fontSize: 15 }}>{label}</Text>
        {detail ? <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Stepper({ label, value, onChange, min, max, step = 1, format = (v: number) => String(v), dot }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; format?: (v: number) => string; dot?: string;
}) {
  const btn = (text: string, d: number, a11y: string) => (
    <Pressable
      onPress={() => onChange(Math.max(min, Math.min(max, value + d)))}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.stepBtn, pressed && { opacity: 0.6 }]}
    >
      <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>{text}</Text>
    </Pressable>
  );
  return (
    <Row>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
        {dot ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} /> : null}
        <Text style={{ color: C.text, fontSize: 15 }}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {btn('−', -step, `${label} lavere`)}
        <Text style={{ color: C.text, minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{format(value)}</Text>
        {btn('+', step, `${label} højere`)}
      </View>
    </Row>
  );
}

export function Toggle({ label, value, onChange, accent }: { label: string; value: boolean; onChange: (v: boolean) => void; accent: string }) {
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} style={styles.row}>
      <Text style={{ color: C.text, fontSize: 15, flex: 1 }}>{label}</Text>
      <View style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: value ? accent : C.border, padding: 3, alignItems: value ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: value ? C.onAccent : C.text }} />
      </View>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.panelHigh, borderRadius: 10, padding: 3, gap: 3 }}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          accessibilityRole="button"
          accessibilityState={{ selected: o.value === value }}
          style={{ flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center', backgroundColor: o.value === value ? C.border : 'transparent' }}
        >
          <Text style={{ color: C.text, fontWeight: '700' }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 520, maxHeight: '94%', backgroundColor: C.panel, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { color: C.text, fontSize: 16, fontWeight: '700' },
  body: { padding: 16, paddingTop: 6, gap: 6 },
  section: { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 12, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 46, borderRadius: 10, backgroundColor: C.panelHigh },
  note: { color: C.muted, fontSize: 12, lineHeight: 17, marginHorizontal: 2, marginTop: 2 },
  stepBtn: { width: 34, height: 30, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
});
