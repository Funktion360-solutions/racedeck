// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

export type DashStyle = 'standard' | 'racing';

export type WidgetKind =
  | 'cockpit' | 'speed' | 'rpm' | 'gear' | 'pedals' | 'fuel' | 'fuelCompact' | 'lapTime' | 'lapTimes' | 'delta'
  | 'lapCount' | 'position' | 'raceInfo' | 'tyres' | 'map' | 'assists' | 'temps' | 'distance' | 'timer';

export interface KindInfo {
  title: string;
  detail: string;
  span: number;
  tall: boolean;
}

export const KINDS: Record<WidgetKind, KindInfo> = {
  cockpit: { title: 'Gear + omdrejninger', detail: 'Stort gear i midten med omdrejninger, skiftelys og pedaler.', span: 3, tall: true },
  speed: { title: 'Hastighed', detail: 'Hastighed med topfart.', span: 2, tall: false },
  rpm: { title: 'Omdrejninger', detail: 'Omdrejninger og skiftelys fra bilens egne grænser.', span: 2, tall: false },
  gear: { title: 'Gear', detail: 'Aktuelt gear og foreslået gear.', span: 1, tall: false },
  pedals: { title: 'Pedaler', detail: 'Gas og bremse.', span: 2, tall: false },
  fuel: { title: 'Brændstof', detail: 'Tank, forbrug pr. omgang, omgange og tid tilbage.', span: 3, tall: false },
  fuelCompact: { title: 'Brændstof kompakt', detail: 'Liter i tanken, liter pr. omgang og omgange tilbage.', span: 2, tall: false },
  lapTime: { title: 'Aktuel omgang', detail: 'Tiden på den omgang du kører nu.', span: 1, tall: false },
  lapTimes: { title: 'Omgangstider', detail: 'Aktuel, seneste, bedste og gennemsnitlig omgang.', span: 2, tall: true },
  delta: { title: 'Delta', detail: 'Plus/minus mod din bedste omgang, målt hen over omgangen.', span: 2, tall: false },
  lapCount: { title: 'Omgangstæller', detail: 'Omgang ud af antal omgange.', span: 1, tall: false },
  position: { title: 'Placering', detail: 'Din placering i løbet.', span: 1, tall: false },
  raceInfo: { title: 'Løbsinfo', detail: 'Sessionstid, placering og omgang i én boks.', span: 2, tall: false },
  tyres: { title: 'Dæk · alle fire', detail: 'Temperatur på alle fire dæk med glidende farver.', span: 3, tall: true },
  map: { title: 'Banekort', detail: 'Tegner banen mens du kører, med din position.', span: 3, tall: true },
  assists: { title: 'TCS / ASM', detail: 'Lyser når traction control eller ASM griber ind.', span: 1, tall: false },
  temps: { title: 'Motor', detail: 'Vand, olie og turbotryk.', span: 1, tall: false },
  distance: { title: 'Distance', detail: 'Kørt distance og topfart i sessionen.', span: 1, tall: false },
  timer: { title: 'Sessionstid', detail: 'Samlet tid i sessionen.', span: 1, tall: false },
};

export const KIND_ORDER = Object.keys(KINDS) as WidgetKind[];

export interface DashWidget {
  id: string;
  kind: WidgetKind;
  span: number; // columns out of COLUMNS
  tall: boolean;
}

export interface DashLayout {
  id: string;
  name: string;
  accent: number;
  style: DashStyle;
  widgets: DashWidget[];
}

export const COLUMNS = 6;

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const widget = (kind: WidgetKind, span?: number, tall?: boolean): DashWidget => ({
  id: uid(),
  kind,
  span: span ?? KINDS[kind].span,
  tall: tall ?? KINDS[kind].tall,
});

export function defaultLayouts(): DashLayout[] {
  return [
    {
      id: uid(), name: 'Race', accent: 0, style: 'standard',
      widgets: [widget('speed', 1, true), widget('cockpit', 2, true), widget('tyres', 2, true), widget('lapTimes', 1, true),
        widget('fuel', 4, false), widget('lapCount', 1, false), widget('position', 1, false)],
    },
    {
      id: uid(), name: 'Racerdisplay', accent: 4, style: 'racing',
      widgets: [widget('assists', 2, false), widget('delta', 2, false), widget('raceInfo', 2, false),
        widget('lapTimes', 2, true), widget('cockpit', 2, true), widget('tyres', 2, true),
        widget('temps', 1, false), widget('speed', 1, false), widget('fuelCompact', 4, false)],
    },
    {
      id: uid(), name: 'Dæk & brændstof', accent: 2, style: 'standard',
      widgets: [widget('tyres', 4, true), widget('lapTimes', 2, true), widget('fuel', 4, false), widget('speed', 2, false)],
    },
    {
      id: uid(), name: 'Overblik', accent: 1, style: 'standard',
      widgets: [widget('speed', 2, false), widget('rpm', 2, false), widget('gear', 1, false), widget('lapTime', 1, false),
        widget('pedals', 2, false), widget('fuel', 2, false), widget('assists', 1, false), widget('temps', 1, false),
        widget('map', 3, true), widget('tyres', 3, true)],
    },
  ];
}

export interface Row {
  items: { widget: DashWidget; span: number }[];
  tall: boolean;
}

/** Packs widgets into rows on the 6-column grid (same as the iOS version). */
export function pack(widgets: DashWidget[], columns = COLUMNS): Row[] {
  const rows: Row[] = [];
  let row: Row = { items: [], tall: false };
  let used = 0;
  for (const w of widgets) {
    const span = Math.max(1, Math.min(columns, w.span));
    if (used + span > columns && row.items.length) {
      rows.push(row);
      row = { items: [], tall: false };
      used = 0;
    }
    row.items.push({ widget: w, span });
    used += span;
    row.tall = row.tall || w.tall;
  }
  if (row.items.length) rows.push(row);
  return rows;
}

/** Validates a layout loaded from storage or imported from a share code. */
export function isLayout(x: unknown): x is DashLayout {
  const l = x as DashLayout;
  return !!l && typeof l.id === 'string' && typeof l.name === 'string' && typeof l.accent === 'number' &&
    Array.isArray(l.widgets) && l.widgets.every((w) => w && typeof w.id === 'string' && w.kind in KINDS && typeof w.span === 'number' && typeof w.tall === 'boolean');
}

const SHARE_PREFIX = 'RACEDECK1:';

/** A page as a short text code that can be sent to a friend. */
export function exportLayout(l: DashLayout): string {
  const json = JSON.stringify({ name: l.name, accent: l.accent, style: l.style, widgets: l.widgets.map(({ kind, span, tall }) => ({ kind, span, tall })) });
  return SHARE_PREFIX + encodeURIComponent(json);
}

export function importLayout(code: string): DashLayout | null {
  const text = code.trim();
  if (!text.startsWith(SHARE_PREFIX)) return null;
  try {
    const data = JSON.parse(decodeURIComponent(text.slice(SHARE_PREFIX.length)));
    const layout: DashLayout = {
      id: uid(),
      name: String(data.name ?? 'Importeret side').slice(0, 40),
      accent: Number(data.accent) || 0,
      style: data.style === 'racing' ? 'racing' : 'standard',
      widgets: (data.widgets ?? []).map((w: { kind: WidgetKind; span: number; tall: boolean }) => ({ id: uid(), kind: w.kind, span: Number(w.span) || 1, tall: !!w.tall })),
    };
    return isLayout(layout) ? layout : null;
  } catch {
    return null;
  }
}
