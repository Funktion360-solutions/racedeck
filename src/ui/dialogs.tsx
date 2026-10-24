// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import { Pressable, Share, Text, TextInput, View } from 'react-native';
import { COLUMNS, DashWidget, KINDS, KIND_ORDER, WidgetKind, exportLayout, importLayout, uid } from '../model/layouts';
import { GT7_TYRES, useStore } from '../model/store';
import { hub, stateLabel, useTelemetry } from '../telemetry/hub';
import { isExpoGo, isValidIp } from '../telemetry/udp';
import { engineer } from '../engineer';
import type { Chattiness, EngineerSettings } from '../engineer/brain';
import { VoiceInfo, findDanishVoice } from '../engineer/voice';
import { ElevenVoice, getApiKey, listVoices, setApiKey } from '../engineer/eleven';
import { canListen } from '../engineer/listen';
import { ListButton, Note, Row, Section, Segmented, Sheet, Stepper, Toggle } from './Sheet';
import { ACCENTS, ACCENT_NAMES, C, tyreColor } from './theme';

// ---------- One widget ----------

export function WidgetEditor({ widget, onClose, accent }: { widget: DashWidget | null; onClose: () => void; accent: string }) {
  const { selected, updateWidget, removeWidget, moveWidget } = useStore();
  const current = widget ? selected.widgets.find((w) => w.id === widget.id) ?? null : null;
  const [choosingType, setChoosingType] = useState(false);
  useEffect(() => setChoosingType(false), [widget?.id]);
  if (!current) return <Sheet visible={false} title="" onClose={onClose} accent={accent}>{null}</Sheet>;
  const set = (patch: Partial<DashWidget>) => updateWidget({ ...current, ...patch });
  return (
    <Sheet visible title={KINDS[current.kind].title} onClose={onClose} accent={accent}>
      <Section>Widget</Section>
      <Pressable onPress={() => setChoosingType((v) => !v)} style={{ backgroundColor: C.panelHigh, borderRadius: 10, padding: 12, gap: 2 }} accessibilityRole="button">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: C.text, fontSize: 15 }}>Type</Text>
          <Text style={{ color: C.muted, fontSize: 15 }}>{KINDS[current.kind].title} {choosingType ? '▴' : '▾'}</Text>
        </View>
        <Text style={{ color: C.muted, fontSize: 12 }}>{KINDS[current.kind].detail}</Text>
      </Pressable>
      {choosingType ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {KIND_ORDER.map((k) => (
            <Pressable
              key={k}
              onPress={() => { set({ kind: k }); setChoosingType(false); }}
              style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: k === current.kind ? accent : C.panelHigh }}
            >
              <Text style={{ color: k === current.kind ? C.onAccent : C.text, fontSize: 13, fontWeight: '600' }}>{KINDS[k].title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Section>Størrelse</Section>
      <Stepper label="Bredde" value={current.span} min={1} max={COLUMNS} onChange={(v) => set({ span: v })} format={(v) => `${v} af ${COLUMNS}`} />
      <Toggle label="Dobbelt højde" value={current.tall} onChange={(v) => set({ tall: v })} accent={accent} />
      <Section>Placering</Section>
      <ListButton icon="←" label="Flyt tidligere" onPress={() => moveWidget(current.id, -1)} accent={accent} />
      <ListButton icon="→" label="Flyt senere" onPress={() => moveWidget(current.id, 1)} accent={accent} />
      <Note>Du kan også holde fingeren på en widget og derefter trykke der, hvor den skal stå.</Note>
      <View style={{ height: 8 }} />
      <ListButton icon="✕" label="Fjern widget" danger onPress={() => { removeWidget(current.id); onClose(); }} accent={accent} />
    </Sheet>
  );
}

// ---------- Add widget ----------

export function WidgetPicker({ visible, onClose, accent }: { visible: boolean; onClose: () => void; accent: string }) {
  const { addWidget } = useStore();
  return (
    <Sheet visible={visible} title="Tilføj widget" onClose={onClose} closeLabel="Luk" accent={accent}>
      {KIND_ORDER.map((k: WidgetKind) => (
        <ListButton key={k} icon="+" label={KINDS[k].title} detail={KINDS[k].detail} onPress={() => { addWidget(k); onClose(); }} accent={accent} />
      ))}
    </Sheet>
  );
}

// ---------- Pages ----------

export function PagesSheet({ visible, onClose, accent }: { visible: boolean; onClose: () => void; accent: string }) {
  const { layouts, selectedId, select, updateLayout, duplicateLayout, deleteLayout, moveLayout, addLayout, restoreDefaults } = useStore();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pasteCode, setPasteCode] = useState('');

  const doImport = async (code?: string) => {
    const text = code ?? (await Clipboard.getStringAsync().catch(() => ''));
    const layout = importLayout(text);
    if (!layout) {
      setMessage('Fandt ingen RaceDeck-kode. Kopiér koden og prøv igen, eller indsæt den i feltet.');
      return;
    }
    addLayout(layout);
    setPasteCode('');
    setMessage(`“${layout.name}” er importeret.`);
  };

  return (
    <Sheet visible={visible} title="Sider" onClose={() => { setConfirmReset(false); setMessage(null); onClose(); }} accent={accent}>
      <Section>Sider</Section>
      {layouts.map((l, i) => {
        const isSel = l.id === selectedId;
        return (
          <View key={l.id} style={{ backgroundColor: C.panelHigh, borderRadius: 10, padding: 10, gap: 8, borderWidth: isSel ? 1.5 : 0, borderColor: ACCENTS[l.accent] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                value={l.name}
                onChangeText={(name) => updateLayout(l.id, { name: name.slice(0, 40) })}
                style={{ flex: 1, color: C.text, fontSize: 15, paddingVertical: 4 }}
                accessibilityLabel="Navn på side"
                maxLength={40}
              />
              <SmallBtn label={isSel ? '● Valgt' : 'Vælg'} onPress={() => select(l.id)} color={isSel ? ACCENTS[l.accent] : C.text} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {ACCENTS.map((c, ci) => (
                <Pressable key={c} onPress={() => updateLayout(l.id, { accent: ci })} accessibilityLabel={ACCENT_NAMES[ci]} hitSlop={4}
                  style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c, borderWidth: ci === l.accent ? 2 : 0, borderColor: C.text }} />
              ))}
              <SmallBtn label={l.style === 'racing' ? 'Stil: Racer' : 'Stil: Standard'} onPress={() => updateLayout(l.id, { style: l.style === 'racing' ? 'standard' : 'racing' })} />
              <View style={{ flex: 1 }} />
              <SmallBtn label="↑" onPress={() => moveLayout(l.id, -1)} disabled={i === 0} />
              <SmallBtn label="↓" onPress={() => moveLayout(l.id, 1)} disabled={i === layouts.length - 1} />
              <SmallBtn label="Kopi" onPress={() => duplicateLayout(l.id)} />
              <SmallBtn label="Del" onPress={() => Share.share({ message: exportLayout(l) }).catch(() => {})} />
              {layouts.length > 1 ? <SmallBtn label="Slet" onPress={() => deleteLayout(l.id)} color={C.hot} /> : null}
            </View>
          </View>
        );
      })}
      <Note>Under kørsel swiper du mellem siderne i denne rækkefølge. “Del” laver en kode, som andre kan importere.</Note>
      <ListButton icon="+" label="Ny tom side" onPress={() => addLayout({ id: uid(), name: 'Ny side', accent: 0, style: 'standard', widgets: [] })} accent={accent} />
      <ListButton icon="⎘" label="Importér side fra udklipsholder" onPress={() => doImport()} accent={accent} />
      <Row>
        <TextInput value={pasteCode} onChangeText={setPasteCode} placeholder="…eller indsæt en RACEDECK1-kode her" placeholderTextColor={C.faint}
          style={{ flex: 1, color: C.text, fontSize: 14 }} autoCapitalize="none" autoCorrect={false} />
        <SmallBtn label="Importér" onPress={() => doImport(pasteCode)} disabled={!pasteCode.trim()} />
      </Row>
      {message ? <Note>{message}</Note> : null}
      <View style={{ height: 6 }} />
      <ListButton icon="↺" danger label={confirmReset ? 'Tryk igen for at gendanne standardsiderne' : 'Gendan standardsider'}
        onPress={() => { if (confirmReset) { restoreDefaults(); setConfirmReset(false); } else setConfirmReset(true); }} accent={accent} />
    </Sheet>
  );
}

function SmallBtn({ label, onPress, color = C.text, disabled }: { label: string; onPress: () => void; color?: string; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={4} accessibilityRole="button"
      style={({ pressed }) => ({ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel, opacity: disabled ? 0.35 : pressed ? 0.6 : 1 })}>
      <Text style={{ color, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

// ---------- Settings ----------

export function SettingsSheet({ visible, onClose, accent }: { visible: boolean; onClose: () => void; accent: string }) {
  const { settings, updateSettings } = useStore();
  const t = useTelemetry();
  const [ip, setIp] = useState(settings.ps5Address);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { if (visible) setIp(settings.ps5Address); }, [visible, settings.ps5Address]);

  const connect = () => {
    const trimmed = ip.trim();
    if (trimmed === settings.ps5Address) hub.start('ps5', trimmed); // retry
    else updateSettings({ ps5Address: trimmed }); // App restarts the connection
  };

  const scale = Array.from({ length: 24 }, (_, i) => tyreColor(40 + i * 3.5, settings));
  const [danishVoice, setDanishVoice] = useState<VoiceInfo | null | undefined>(undefined);
  useEffect(() => {
    if (visible) findDanishVoice().then(setDanishVoice).catch(() => setDanishVoice(null));
  }, [visible]);
  const eng = settings.engineer;
  const ai = settings.ai;
  const setAi = (patch: Partial<typeof ai>) => updateSettings({ ai: { ...ai, ...patch } });
  const setOllama = (patch: Partial<typeof ai.ollama>) => setAi({ ollama: { ...ai.ollama, ...patch } });
  const [hasKey, setHasKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [voices, setVoices] = useState<ElevenVoice[] | null>(null);
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const [manualVoice, setManualVoice] = useState('');
  const [ownKeyOpen, setOwnKeyOpen] = useState(false);
  useEffect(() => {
    if (visible) getApiKey().then((k) => setHasKey(!!k)).catch(() => setHasKey(false));
  }, [visible]);
  const saveKey = async () => {
    const k = keyDraft.trim();
    if (!k) return;
    await setApiKey(k);
    setHasKey(true);
    setKeyDraft('');
    loadVoices(k);
  };
  const removeKey = async () => {
    await setApiKey(null);
    setHasKey(false);
    setVoices(null);
    setAi({ elevenVoiceId: '', elevenVoiceName: '' });
    setOwnKeyOpen(false);
    setVoiceMsg('Nøglen er slettet fra telefonen. Fælles stemme bruges kun, hvis den er aktiveret; ellers bruges telefonens stemme.');
  };
  const loadVoices = async (k?: string) => {
    setVoiceMsg('Henter dine stemmer …');
    try {
      const key = k ?? (await getApiKey());
      if (!key) return setVoiceMsg('Indsæt din nøgle først.');
      const list = await listVoices(key);
      setVoices(list);
      setVoiceMsg(list.length ? 'Vælg en stemme. Danske stemmer står øverst.' : 'Der er ingen stemmer på din konto endnu. Tilføj en dansk stemme fra Voice Library på elevenlabs.io.');
    } catch (e) {
      setVoiceMsg(`${(e as Error).message} Du kan også indsætte et Voice ID manuelt nedenfor.`);
    }
  };
  const chooseVoice = (id: string, name: string) => {
    setAi({ voice: 'ai', elevenVoiceId: id, elevenVoiceName: name });
    setVoiceMsg(`Valgt: ${name}. Tryk "Test stemme" ovenfor.`);
  };
  const [aiTest, setAiTest] = useState<string | null>(null);
  const [aiTesting, setAiTesting] = useState(false);
  const runAiTest = () => {
    setAiTesting(true);
    setAiTest('Kontakter AI-hjernen … (første gang kan tage op til et minut, mens modellen indlæses)');
    engineer
      .testAi()
      .then(setAiTest)
      .catch(() => setAiTest('Testen fejlede.'))
      .finally(() => setAiTesting(false));
  };
  const setEng = (patch: Partial<EngineerSettings>) => updateSettings({ engineer: { ...eng, ...patch } });

  return (
    <Sheet visible={visible} title="Indstillinger" onClose={() => { setConfirmReset(false); onClose(); }} accent={accent}>
      <Section>Forbindelse</Section>
      <Segmented options={[{ value: 'ps5', label: 'PS5 (live)' }, { value: 'demo', label: 'Demo' }]} value={settings.source} onChange={(source) => updateSettings({ source })} />
      {settings.source === 'ps5' ? (
        <Row>
          <TextInput
            value={ip}
            onChangeText={setIp}
            placeholder="PS5's IP-adresse, fx 192.168.1.23"
            placeholderTextColor={C.faint}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={connect}
            style={{ flex: 1, color: C.text, fontSize: 15 }}
            accessibilityLabel="PS5's IP-adresse"
          />
          <Pressable onPress={connect} disabled={!isValidIp(ip)} accessibilityRole="button"
            style={{ backgroundColor: accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, opacity: isValidIp(ip) ? 1 : 0.4 }}>
            <Text style={{ color: C.onAccent, fontWeight: '800' }}>Forbind</Text>
          </Pressable>
        </Row>
      ) : null}
      <Row>
        <Text style={{ color: C.text, fontSize: 15 }}>Status</Text>
        <Text style={{ color: C.muted }}>{stateLabel[t.state]}{t.state === 'live' || t.state === 'demo' || t.state === 'paused' ? ` · ${t.packetsPerSecond} pakker/s` : ''}</Text>
      </Row>
      {t.error ? <Note style={{ color: C.hot }}>{t.error}</Note> : null}
      <Note>
        {settings.source === 'ps5'
          ? 'Find IP-adressen på din PS5 under Indstillinger → Netværk → Forbindelsesstatus → Vis forbindelsesstatus (IPv4-adresse). Telefonen og PS5 skal være på samme Wi-Fi, og GT7 skal køre. Første gang spørger telefonen om adgang til lokalt netværk – tryk Tillad. Appen husker adressen og forbinder selv næste gang.'
          : 'Demo kører en simuleret bil rundt på en bane, så du kan prøve dine sider uden PS5.'}
      </Note>
      {settings.source === 'ps5' && isExpoGo ? (
        <Note style={{ color: C.warm }}>Du kører i Expo Go, som ikke kan modtage data fra PS5. Brug et development build af RaceDeck – se LÆS-MIG.</Note>
      ) : null}

      <Section>Løbsingeniør</Section>
      <Toggle label="Løbsingeniøren taler til mig under kørsel" value={eng.enabled} onChange={(enabled) => setEng({ enabled })} accent={accent} />
      {eng.enabled ? (
        <>
          <Segmented<Chattiness>
            options={[{ value: 'low', label: 'Lidt' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'Meget' }]}
            value={eng.chatty}
            onChange={(chatty) => setEng({ chatty })}
          />
          <Toggle label="Omgangstider og ny bedste omgang" value={eng.lapTimes} onChange={(lapTimes) => setEng({ lapTimes })} accent={accent} />
          <Toggle label="Delta midt på omgangen (foran/bagud)" value={eng.delta} onChange={(delta) => setEng({ delta })} accent={accent} />
          <Toggle label="Brændstof og pitstop (hvornår du skal ind)" value={eng.fuel} onChange={(fuel) => setEng({ fuel })} accent={accent} />
          <Toggle label="Dæk (for varme, kolde eller slidte)" value={eng.tyres} onChange={(tyres) => setEng({ tyres })} accent={accent} />
          <Toggle label="Placering (overhalinger)" value={eng.position} onChange={(position) => setEng({ position })} accent={accent} />
          <Toggle label="Løbet (to omgange tilbage, sidste omgang)" value={eng.race} onChange={(race) => setEng({ race })} accent={accent} />
          <Stepper label="Talehastighed" value={Math.round(eng.rate * 10)} min={7} max={13} onChange={(v) => setEng({ rate: v / 10 })} format={(v) => `${(v / 10).toFixed(1).replace('.', ',')}×`} />
          <ListButton icon="▶" label="Test stemme" onPress={() => engineer.test()} accent={accent} />
          <Toggle label="Sig &quot;Mads&quot; for at spørge (ingen knap)" value={ai.wakeWord} onChange={(wakeWord) => setAi({ wakeWord })} accent={accent} />
          <Note>{canListen()
            ? 'Løbsingeniøren hedder Mads. Når Kør er åben, lytter telefonen efter hans navn: sig fx "Mads, hvornår skal jeg i pit?" eller bare "Mads" – så svarer han "Ja?" og lytter. Han holder pause med at lytte, mens han selv taler. Funktionen bruger lokal talegenkendelse og virker kun, mens RaceDeck er åben. Den er slået fra som standard og bruger mere strøm, når den er aktiv.'
            : 'At sige "Mads" kræver den rigtige app fra TestFlight (virker ikke i Expo Go).'}</Note>
        </>
      ) : null}
      <Note>
        {danishVoice === undefined
          ? 'Leder efter en dansk stemme …'
          : danishVoice
            ? `Stemme: ${danishVoice.name}${danishVoice.enhanced ? ' (forbedret)' : ''}. Løbsingeniøren taler, når Kør er åben og kan slås fra med 🔊 øverst.`
            : 'Der er ingen dansk stemme på telefonen. iPhone: Indstillinger → Tilgængelighed → Oplæst indhold → Stemmer → Dansk. Android: Indstillinger → Tekst-til-tale → installér dansk.'}
      </Note>
      <Note>Tip: Vælg en "forbedret" eller "premium" dansk stemme på telefonen – den lyder meget mere naturlig.</Note>

      <Section>AI-stemme</Section>
      <Segmented<'ai' | 'device'>
        options={[{ value: 'ai', label: 'Naturlig AI-stemme' }, { value: 'device', label: 'Telefonens stemme' }]}
        value={ai.voice}
        onChange={(v) => setAi({ voice: v })}
      />
      {ai.voice === 'ai' ? (
        <>
          {engineer.sharedVoiceAvailable && !(hasKey && ai.elevenVoiceId) ? (
            <Segmented<'a' | 'b'>
              options={[{ value: 'a', label: 'Stemme 1' }, { value: 'b', label: 'Stemme 2' }]}
              value={ai.voiceVariant}
              onChange={(v) => setAi({ voiceVariant: v })}
            />
          ) : null}
          <Note>
            {hasKey && ai.elevenVoiceId
              ? `Bruger din egen ElevenLabs-stemme (${ai.elevenVoiceName || ai.elevenVoiceId}).`
              : engineer.sharedVoiceAvailable
                ? 'Ved valg af AI-stemme sendes beskedtekst til ElevenLabs via RaceDecks stemmeserver. Det kræver internet. Vælg telefonens stemme for at undgå denne overførsel. Når månedens fælles kvote er brugt, skifter den automatisk til telefonens stemme – eller du kan bruge din egen ElevenLabs-nøgle nedenfor.'
                : 'Den fælles AI-stemme er ikke aktiveret i denne version. Brug din egen ElevenLabs-nøgle nedenfor, ellers bruges telefonens stemme.'}
          </Note>
          {engineer.aiVoiceError ? <Note style={{ color: C.warm }}>Seneste problem: {engineer.aiVoiceError}</Note> : null}
          <Toggle label="Brug min egen ElevenLabs-nøgle (valgfrit)" value={ownKeyOpen || hasKey} onChange={(v) => setOwnKeyOpen(v)} accent={accent} />
          {ownKeyOpen || hasKey ? (
            <>
          {hasKey ? (
            <Row>
              <Text style={{ color: C.text, fontSize: 15 }}>ElevenLabs-nøgle</Text>
              <Text style={{ color: C.good }}>Gemt ✓</Text>
            </Row>
          ) : (
            <Row>
              <TextInput
                value={keyDraft}
                onChangeText={setKeyDraft}
                placeholder="Indsæt din ElevenLabs API-nøgle"
                placeholderTextColor={C.faint}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={{ flex: 1, color: C.text, fontSize: 15 }}
                accessibilityLabel="ElevenLabs API-nøgle"
              />
              <Pressable onPress={saveKey} disabled={!keyDraft.trim()} accessibilityRole="button"
                style={{ backgroundColor: accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, opacity: keyDraft.trim() ? 1 : 0.4 }}>
                <Text style={{ color: C.onAccent, fontWeight: '800' }}>Gem</Text>
              </Pressable>
            </Row>
          )}
          <Row>
            <Text style={{ color: C.text, fontSize: 15 }}>Stemme</Text>
            <Text style={{ color: ai.elevenVoiceId ? C.text : C.muted, flex: 1, textAlign: 'right' }} numberOfLines={1}>{ai.elevenVoiceName || ai.elevenVoiceId || 'Ikke valgt'}</Text>
          </Row>
          {hasKey ? <ListButton icon="↻" label="Hent mine stemmer" onPress={() => loadVoices()} accent={accent} /> : null}
          {voices
            ? [...voices]
              .sort((a, b) => Number(/dan/i.test(b.language ?? '')) - Number(/dan/i.test(a.language ?? '')))
              .map((v) => (
                <ListButton key={v.id} icon={v.id === ai.elevenVoiceId ? '●' : '○'} label={v.name} detail={v.language ?? undefined} onPress={() => chooseVoice(v.id, v.name)} accent={accent} />
              ))
            : null}
          {hasKey ? (
            <Row>
              <TextInput
                value={manualVoice}
                onChangeText={setManualVoice}
                placeholder="…eller indsæt et Voice ID"
                placeholderTextColor={C.faint}
                autoCapitalize="none"
                autoCorrect={false}
                style={{ flex: 1, color: C.text, fontSize: 14 }}
                accessibilityLabel="Voice ID"
              />
              <Pressable onPress={() => { if (manualVoice.trim()) chooseVoice(manualVoice.trim(), manualVoice.trim()); setManualVoice(''); }} accessibilityRole="button"
                style={{ borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: C.border, opacity: manualVoice.trim() ? 1 : 0.4 }}>
                <Text style={{ color: C.text, fontWeight: '700' }}>Brug</Text>
              </Pressable>
            </Row>
          ) : null}
          {voiceMsg ? <Note>{voiceMsg}</Note> : null}
          {hasKey ? <ListButton icon="✕" danger label="Slet nøglen fra telefonen" onPress={removeKey} accent={accent} /> : null}
              <Note>
                Med din egen nøgle bruger du ikke af RaceDecks fælles kvote. Brug en ElevenLabs-konto med passende licens og kvote. Tilføj en dansk stemme, og opret en nøgle med adgang til "Text to Speech" og "Voices". Sæt en kreditgrænse på nøglen; du betaler selv for din kontos forbrug. Nøglen gemmes krypteret på telefonen og sendes kun til ElevenLabs.
              </Note>
            </>
          ) : null}
        </>
      ) : (
        <Note>Telefonens indbyggede danske stemme. Gratis og virker uden internet.</Note>
      )}

      <Section>AI-hjerne (lokal, Ollama)</Section>
      <Toggle label="Brug lokal AI til at formulere beskeder og svare" value={ai.ollama.enabled} onChange={(enabled) => setOllama({ enabled })} accent={accent} />
      {ai.ollama.enabled ? (
        <>
          <Row>
            <Text style={{ color: C.text, fontSize: 15 }}>Computer</Text>
            <TextInput
              value={ai.ollama.host}
              onChangeText={(host) => setOllama({ host: host.trim() })}
              placeholder="IP på computeren, fx 192.168.1.50"
              placeholderTextColor={C.faint}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1, color: C.text, fontSize: 15, textAlign: 'right' }}
              accessibilityLabel="IP-adresse på computeren med Ollama"
            />
          </Row>
          <Row>
            <Text style={{ color: C.text, fontSize: 15 }}>Model</Text>
            <TextInput
              value={ai.ollama.model}
              onChangeText={(model) => setOllama({ model: model.trim() })}
              placeholder="qwen2.5:7b"
              placeholderTextColor={C.faint}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1, color: C.text, fontSize: 15, textAlign: 'right' }}
              accessibilityLabel="Ollama-model"
            />
          </Row>
          <ListButton icon="▶" label={aiTesting ? 'Tester …' : 'Test AI-hjernen'} onPress={() => { if (!aiTesting) runAiTest(); }} accent={accent} />
          {aiTest ? <Note>{aiTest}</Note> : null}
        </>
      ) : null}
      <Note>
        Ollama kører på din egen computer på det lokale netværk. AI’en vælger mellem godkendte formuleringer og hjælper med at forstå spørgsmål. Svar bygges på kendte data, ikke frie gæt om fx bremsepunkter eller sektorer. Ved langsomme svar bruges den normale besked. Akutte beskeder springer AI-hjernen over.
      </Note>

      <Section>Pitstrategi</Section>
      <Stepper label="Reserve ved pitstop" value={Math.round(eng.pitReserve * 10)} min={0} max={10} onChange={(v) => setEng({ pitReserve: v / 10 })} format={(v) => `${(v / 10).toFixed(1).replace('.', ',')} omg.`} />
      <Stepper label="Skift dæk ved" value={eng.tyreChangeAt} min={10} max={60} step={5} onChange={(tyreChangeAt) => setEng({ tyreChangeAt })} format={(v) => `${v} % tilbage`} />
      <Stepper label="Fast dækskift efter" value={eng.tyreStint} min={0} max={60} onChange={(tyreStint) => setEng({ tyreStint })} format={(v) => (v === 0 ? 'Fra' : `${v} omg.`)} />
      <Note>Pitplanen bygger på dit brændstofforbrug pr. omgang (gennemsnit af de sidste tre hele omgange) og løbets længde. Den beregner, hvornår du senest skal ind, og hvor meget du skal tanke for at nå i mål med reserven ovenfor – uden at køre med mere vægt end nødvendigt. GT7 sender ikke dækslid, så du melder det selv i kør-tilstand: tryk ? → 🛞 Meld slid, eller sig "dækkene har 70 procent tilbage". Så udregner han slid pr. omgang og tager dækskiftet med i planen. Kender du på forhånd antal omgange pr. dæksæt, kan du i stedet sætte et fast dækskift. Han advarer også, hvis dine omgangstider falder, så dækkene ser slidte ud.</Note>

      <Section>Visning</Section>
      <Toggle label="Mph i stedet for km/t" value={settings.useMPH} onChange={(useMPH) => updateSettings({ useMPH })} accent={accent} />
      <Toggle label="Hold skærmen tændt under kørsel" value={settings.keepScreenOn} onChange={(keepScreenOn) => updateSettings({ keepScreenOn })} accent={accent} />
      <Toggle label="Blinkende skiftelys ved omdrejningsgrænsen" value={settings.shiftFlash} onChange={(shiftFlash) => updateSettings({ shiftFlash })} accent={accent} />

      <Section>Banekort</Section>
      {visible ? <TrackLibraryButton accent={accent} /> : null}
      <Note>GT7 sender ikke, hvilken bane du kører på, så RaceDeck genkender den ud fra, hvor bilen kører. 84 banelayouts er indbygget. Kortet vises, når nok af din kørsel passer til en kendt bane. Baner med fælles sving kan tage længere tid at skelne. Baner, appen ikke kender (fx nye baner fra en GT7-opdatering), tegnes første gang og gemmes, så de også kommer med det samme næste gang.</Note>

      <Section>Dæktemperatur</Section>
      <Stepper label="Kold (blå) under" dot="#4fa8ff" value={settings.tyreCold} min={20} max={settings.tyreWarm - 10} onChange={(tyreCold) => updateSettings({ tyreCold })} format={(v) => `${v} °C`} />
      <Stepper label="Optimal (grøn) til" dot="#6be07a" value={settings.tyreWarm} min={settings.tyreCold + 10} max={settings.tyreHot - 5} onChange={(tyreWarm) => updateSettings({ tyreWarm })} format={(v) => `${v} °C`} />
      <Stepper label="For varm (rød) fra" dot="#f2564b" value={settings.tyreHot} min={settings.tyreWarm + 5} max={160} onChange={(tyreHot) => updateSettings({ tyreHot })} format={(v) => `${v} °C`} />
      <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginVertical: 4 }}>
        {scale.map((c, i) => <View key={i} style={{ flex: 1, backgroundColor: c }} />)}
      </View>
      <ListButton icon="↺" label="Brug GT7-standard (60 / 85 / 95 °C)" onPress={() => updateSettings(GT7_TYRES)} accent={accent} />
      <Note>Farven glider fra blå over grøn og gul til rød. Standarden følger spillernes målinger i GT7, hvor racerdæk slides markant hurtigere fra ca. 88–93 °C.</Note>

      <Section>Session</Section>
      <ListButton icon="↺" label={confirmReset ? 'Tryk igen for at nulstille' : 'Nulstil session'} detail="Sletter omgangstider, brændstofforbrug, delta, topfart og distance. Gemte banekort beholdes."
        onPress={() => { if (confirmReset) { hub.resetSession(); setConfirmReset(false); } else setConfirmReset(true); }} accent={accent} />

      <Section>Om RaceDeck</Section>
      <Row>
        <Text style={{ color: C.text, fontSize: 15 }}>Ejer</Text>
        <Text style={{ color: C.muted }}>Magnus Slot</Text>
      </Row>
      <Note>© 2026 Magnus Slot. Alle rettigheder forbeholdes. Gran Turismo og PlayStation er varemærker tilhørende Sony Interactive Entertainment. RaceDeck er ikke tilknyttet Sony eller Polyphony Digital.</Note>
    </Sheet>
  );
}

// ---------- Welcome ----------

export function WelcomeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const accent = ACCENTS[0];
  const step = (n: string, title: string, text: string) => (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: C.onAccent, fontWeight: '800' }}>{n}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: C.muted, fontSize: 14, marginTop: 2 }}>{text}</Text>
      </View>
    </View>
  );
  return (
    <Sheet visible={visible} title="Velkommen til RaceDeck" onClose={onClose} closeLabel="Kom i gang" accent={accent}>
      <Text style={{ color: C.text, fontSize: 24, fontWeight: '800', marginVertical: 8 }}>Dit løb. Dit overblik.</Text>
      <View style={{ gap: 14 }}>
        {step('1', 'Byg dine sider', 'Tryk Rediger. Tryk på en widget for at ændre den, hold fingeren på den for at flytte den.')}
        {step('2', 'Forbind til GT7', 'Skriv din PS5\'s IP-adresse under ⚙︎ Indstillinger. Telefon og PS5 skal være på samme Wi-Fi.')}
        {step('3', 'Kør', 'Tryk Kør for fuld skærm, og swipe for at skifte side.')}
      </View>
      <Note style={{ marginTop: 10 }}>Indtil du forbinder, kører appen med demodata.</Note>
    </Sheet>
  );
}

function TrackLibraryButton({ accent }: { accent: string }) {
  const [confirm, setConfirm] = useState(false);
  const [count, setCount] = useState(hub.savedTracks);
  useEffect(() => {
    const t = setInterval(() => setCount(hub.savedTracks), 2000);
    return () => clearInterval(t);
  }, []);
  return (
    <ListButton icon="🗺" danger={confirm} label={confirm ? 'Tryk igen for at glemme dine tegnede baner' : 'Glem tegnede baner'}
      detail={`84 indbyggede GT7-baner${count === 0 ? '' : count === 1 ? ' + 1 tegnet af dig' : ` + ${count} tegnet af dig`}.`}
      onPress={() => { if (confirm) { hub.forgetTracks(); setCount(0); setConfirm(false); } else setConfirm(true); }} accent={accent} />
  );
}
