// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Source } from '../telemetry/hub';
import { DashLayout, DashWidget, WidgetKind, defaultLayouts, isLayout, uid, widget } from './layouts';

export interface Settings {
  source: Source;
  ps5Address: string;
  useMPH: boolean;
  keepScreenOn: boolean;
  shiftFlash: boolean;
  /** Tyre colour fades: blue ≤ cold, green from cold+10 to warm, yellow halfway, red ≥ hot. */
  tyreCold: number;
  tyreWarm: number;
  tyreHot: number;
  hasSeenWelcome: boolean;
}

/** Defaults follow GT7 community tests: racing tyres wear sharply from ~88–93 °C. */
export const GT7_TYRES = { tyreCold: 60, tyreWarm: 85, tyreHot: 95 };

const defaultSettings: Settings = {
  source: 'demo', ps5Address: '', useMPH: false, keepScreenOn: true, shiftFlash: true, ...GT7_TYRES, hasSeenWelcome: false,
};

interface Store {
  ready: boolean;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  layouts: DashLayout[];
  selectedId: string;
  selected: DashLayout;
  select: (id: string) => void;
  updateLayout: (id: string, patch: Partial<DashLayout>) => void;
  setLayouts: (layouts: DashLayout[]) => void;
  addLayout: (layout: DashLayout) => void;
  duplicateLayout: (id: string) => void;
  deleteLayout: (id: string) => void;
  moveLayout: (id: string, delta: number) => void;
  restoreDefaults: () => void;
  addWidget: (kind: WidgetKind) => void;
  updateWidget: (widget: DashWidget) => void;
  removeWidget: (id: string) => void;
  moveWidget: (id: string, delta: number) => void;
  moveWidgetBefore: (id: string, targetId: string) => void;
}

const StoreContext = createContext<Store | null>(null);
const KEY = 'racedeck.v1';

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [layouts, setLayoutsState] = useState<DashLayout[]>(() => defaultLayouts());
  const [selectedId, setSelectedId] = useState<string>('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load once
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data?.settings) setSettings({ ...defaultSettings, ...data.settings });
        if (Array.isArray(data?.layouts) && data.layouts.length && data.layouts.every(isLayout)) {
          const loaded = (data.layouts as DashLayout[]).map((l) => ({ ...l, style: l.style ?? 'standard' }));
          setLayoutsState(loaded);
          setSelectedId(loaded.some((l) => l.id === data.selectedId) ? data.selectedId : loaded[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  // Save (debounced)
  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(KEY, JSON.stringify({ settings, layouts, selectedId })).catch(() => {});
    }, 300);
  }, [ready, settings, layouts, selectedId]);

  const selected = layouts.find((l) => l.id === selectedId) ?? layouts[0];

  const setLayouts = useCallback((next: DashLayout[]) => setLayoutsState(next), []);
  const updateLayout = useCallback((id: string, patch: Partial<DashLayout>) => {
    setLayoutsState((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, []);
  const editSelected = useCallback(
    (fn: (widgets: DashWidget[]) => DashWidget[]) => {
      const id = selected.id;
      setLayoutsState((ls) => ls.map((l) => (l.id === id ? { ...l, widgets: fn(l.widgets) } : l)));
    },
    [selected.id],
  );

  const store = useMemo<Store>(
    () => ({
      ready,
      settings,
      updateSettings: (patch) => setSettings((s) => ({ ...s, ...patch })),
      layouts,
      selectedId: selected.id,
      selected,
      select: (id) => setSelectedId(id),
      updateLayout,
      setLayouts,
      addLayout: (layout) => {
        setLayoutsState((ls) => [...ls, layout]);
        setSelectedId(layout.id);
      },
      duplicateLayout: (id) => {
        const source = layouts.find((l) => l.id === id);
        if (!source) return;
        const copy: DashLayout = {
          ...source,
          id: uid(),
          name: (source.name + ' kopi').slice(0, 40),
          widgets: source.widgets.map((w) => ({ ...w, id: uid() })),
        };
        setLayoutsState((ls) => [...ls, copy]);
        setSelectedId(copy.id);
      },
      deleteLayout: (id) => {
        if (layouts.length < 2) return;
        const rest = layouts.filter((l) => l.id !== id);
        setLayoutsState(rest);
        if (selected.id === id) setSelectedId(rest[0].id);
      },
      moveLayout: (id, delta) => {
        setLayoutsState((ls) => {
          const i = ls.findIndex((l) => l.id === id);
          const j = i + delta;
          if (i < 0 || j < 0 || j >= ls.length) return ls;
          const next = [...ls];
          [next[i], next[j]] = [next[j], next[i]];
          return next;
        });
      },
      restoreDefaults: () => {
        const d = defaultLayouts();
        setLayoutsState(d);
        setSelectedId(d[0].id);
      },
      addWidget: (kind) => editSelected((ws) => [...ws, widget(kind)]),
      updateWidget: (w) => editSelected((ws) => ws.map((x) => (x.id === w.id ? w : x))),
      removeWidget: (id) => editSelected((ws) => ws.filter((x) => x.id !== id)),
      moveWidget: (id, delta) =>
        editSelected((ws) => {
          const i = ws.findIndex((w) => w.id === id);
          const j = i + delta;
          if (i < 0 || j < 0 || j >= ws.length) return ws;
          const next = [...ws];
          [next[i], next[j]] = [next[j], next[i]];
          return next;
        }),
      moveWidgetBefore: (id, targetId) =>
        editSelected((ws) => {
          if (id === targetId) return ws;
          const item = ws.find((w) => w.id === id);
          if (!item) return ws;
          const rest = ws.filter((w) => w.id !== id);
          const at = rest.findIndex((w) => w.id === targetId);
          rest.splice(at < 0 ? rest.length : at, 0, item);
          return rest;
        }),
    }),
    [ready, settings, layouts, selected, updateLayout, setLayouts, editSelected],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
