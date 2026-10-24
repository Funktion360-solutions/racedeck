// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, Text, View } from 'react-native';
import { COLUMNS, DashLayout, DashWidget, KINDS, pack } from '../model/layouts';
import { useStore } from '../model/store';
import { useTelemetry } from '../telemetry/hub';
import { C, accentColor, alpha, racingFrameColor } from './theme';
import { Cap, NO_TITLE, WIDGETS } from './widgets';

interface Props {
  layout: DashLayout;
  editing?: boolean;
  /** Stretch rows to fill the available height (drive mode and home screen). */
  fill?: boolean;
  gap?: number;
  onEdit?: (w: DashWidget) => void;
  onAdd?: () => void;
}

/**
 * Lays widgets out in rows on a 6-column grid. While editing:
 * tap a widget to change it, long-press to pick it up, then tap where it should go.
 */
export function Grid({ layout, editing = false, fill = true, gap = 10, onEdit, onAdd }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [picked, setPicked] = useState<string | null>(null);
  const t = useTelemetry();
  const { settings, moveWidgetBefore } = useStore();
  const accent = accentColor(layout.accent);
  const racing = layout.style === 'racing';

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - size.w) > 0.5 || Math.abs(height - size.h) > 0.5) setSize({ w: width, h: height });
  };

  const rows = pack(layout.widgets, COLUMNS);
  const topInset = racing ? 7 : 0; // room for the labels cut into the frames
  const addRow = editing ? 64 + gap : 0;
  const colW = (size.w - gap * (COLUMNS - 1)) / COLUMNS;
  let unit: number;
  if (fill) {
    const units = rows.reduce((a, r) => a + (r.tall ? 2 : 1), 0);
    const tallRows = rows.filter((r) => r.tall).length;
    unit = Math.max(64, (size.h - topInset - addRow - gap * (Math.max(0, rows.length - 1) + tallRows)) / Math.max(1, units));
  } else {
    unit = Math.max(100, Math.min(150, colW * 0.8));
  }

  const card = (w: DashWidget, span: number, height: number) => {
    const width = colW * span + gap * (span - 1);
    const Widget = WIDGETS[w.kind];
    const frame = racingFrameColor(w.kind, accent);
    const isPicked = picked === w.id;
    const pad = racing ? { paddingHorizontal: width < 140 ? 8 : 12, paddingTop: 13, paddingBottom: 8 } : { padding: width < 140 || height < 100 ? 10 : 14 };
    const showTitle = !racing && !NO_TITLE.has(w.kind);
    const titleH = showTitle ? 15 : 0;
    const innerW = width - (racing ? (width < 140 ? 16 : 24) : width < 140 || height < 100 ? 20 : 28);
    const innerH = height - (racing ? 21 : width < 140 || height < 100 ? 20 : 28) - titleH;
    const body = (
      <View
        style={[
          { width, height, borderRadius: racing ? 12 : 14, overflow: racing ? 'visible' : 'hidden' },
          racing
            ? { backgroundColor: C.black, borderWidth: 2.5, borderColor: editing ? accent : frame, borderStyle: editing ? 'dashed' : 'solid' }
            : { backgroundColor: C.panel, borderWidth: editing ? 1.5 : 1, borderColor: editing ? alpha(accent, 0.7) : C.border, borderStyle: editing ? 'dashed' : 'solid' },
          isPicked && { borderColor: C.text, borderWidth: 3, borderStyle: 'solid' },
          pad,
        ]}
      >
        {racing ? (
          <View style={{ position: 'absolute', top: -7, left: 0, right: 0, alignItems: 'center' }} pointerEvents="none">
            <Text numberOfLines={1} style={{ backgroundColor: C.black, color: frame, fontSize: 8.5, fontWeight: '800', letterSpacing: 1.2, paddingHorizontal: 6, textTransform: 'uppercase' }}>
              {KINDS[w.kind].title}
            </Text>
          </View>
        ) : null}
        {showTitle ? <Cap style={{ height: titleH }}>{KINDS[w.kind].title}</Cap> : null}
        <View style={{ flex: 1 }} pointerEvents="none">
          {innerW > 0 && innerH > 0 ? <Widget t={t} s={settings} accent={accent} racing={racing} w={innerW} h={innerH} /> : null}
        </View>
        {editing ? (
          <View style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
            <Text style={{ color: C.onAccent, fontWeight: '800', fontSize: 13 }}>{isPicked ? '✓' : '⚙'}</Text>
          </View>
        ) : null}
      </View>
    );
    if (!editing) return <View key={w.id}>{body}</View>;
    return (
      <Pressable
        key={w.id}
        accessibilityRole="button"
        accessibilityLabel={`Rediger ${KINDS[w.kind].title}`}
        onLongPress={() => setPicked(w.id)}
        onPress={() => {
          if (picked && picked !== w.id) {
            moveWidgetBefore(picked, w.id);
            setPicked(null);
          } else if (picked === w.id) {
            setPicked(null);
          } else {
            onEdit?.(w);
          }
        }}
      >
        {body}
      </Pressable>
    );
  };

  const fits = !editing && fill;
  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      {size.w > 0 ? (
        <ScrollView scrollEnabled={!fits} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap, paddingTop: topInset }}>
          {rows.map((r) => (
            <View key={r.items[0].widget.id} style={{ flexDirection: 'row', gap }}>
              {r.items.map(({ widget: w, span }) => card(w, span, r.tall ? unit * 2 + gap : unit))}
            </View>
          ))}
          {editing ? (
            <View style={{ gap: 6 }}>
              {picked ? <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>Tryk på den widget, den skal stå foran. Tryk på den igen for at fortryde.</Text> : null}
              <Pressable
                onPress={onAdd}
                accessibilityRole="button"
                style={{ height: 56, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: C.border, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: accent, fontWeight: '700', fontSize: 15 }}>+ Tilføj widget</Text>
              </Pressable>
            </View>
          ) : null}
          {!layout.widgets.length && !editing ? (
            <Text style={{ color: C.muted, textAlign: 'center', padding: 40 }}>Siden er tom. Tryk Rediger og tilføj din første widget.</Text>
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
}
