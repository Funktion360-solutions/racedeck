// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import { cloudVoice } from '../config';
import type { Frame } from '../telemetry/frame';
import type { Stats } from '../telemetry/tracker';
import { answer, topicOf } from './answers';
import { EngineerBrain, EngineerSettings, Message, TyreLimits, defaultEngineer } from './brain';
import { OllamaSettings, askOllama, defaultOllama, rephrase, warmUp } from './llm';
import { pitPlan } from './pit';
import { parseTyreCommand } from './tyres';
import { VoiceEngine, voice } from './voice';

export interface EngineerLimits extends TyreLimits {
  tyreWarm: number;
  useMPH: boolean;
}

/** AI settings: which voice, and the optional local AI brain (Ollama). */
export interface AiSettings {
  wakeWord: boolean;
  voice: VoiceEngine;
  /** RaceDeck's shared voice on the server: "a" or "b". */
  voiceVariant: 'a' | 'b';
  /** Optional: a voice from the user's own ElevenLabs account (the key itself is in secure storage). */
  elevenVoiceId: string;
  elevenVoiceName: string;
  ollama: OllamaSettings;
}

export const defaultAi: AiSettings = { voice: cloudVoice ? 'ai' : 'device', voiceVariant: 'a', wakeWord: false, elevenVoiceId: '', elevenVoiceName: '', ollama: defaultOllama };

const r1 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);

/**
 * The race engineer. It always watches the telemetry (so it never replays old
 * news), but only talks while drive mode is open and it is switched on.
 *
 * The rules (brain.ts) decide when to speak and what the facts are. With the local
 * AI on, Ollama rewrites each sentence so it sounds like a real engineer – unless it
 * is urgent, slow or changes a number, in which case the rule's sentence is used.
 */
class RaceEngineer {
  private brain = new EngineerBrain();
  private settings: EngineerSettings = defaultEngineer;
  private ai: AiSettings = defaultAi;
  private limits: EngineerLimits = { tyreCold: 60, tyreWarm: 85, tyreHot: 95, useMPH: false };
  private lastFrame: Frame | null = null;
  private lastStats: Stats | null = null;
  private active = false;
  private rephrasing = 0;
  private generation = 0;

  configure(settings: EngineerSettings, limits: EngineerLimits) {
    this.generation++;
    this.settings = settings;
    this.limits = limits;
    voice.setRate(settings.rate);
    if (!settings.enabled) voice.stop();
  }

  configureAi(ai: AiSettings) {
    this.generation++;
    this.ai = ai;
    voice.stop();
    voice.configure({ engine: ai.voice, rate: this.settings.rate, voiceId: ai.elevenVoiceId, cloud: cloudVoice, variant: ai.voiceVariant });
  }

  /** Drive mode opens/closes. */
  setActive(active: boolean) {
    this.generation++;
    this.active = active;
    if (!active) voice.stop();
    else if (this.ai.ollama.enabled) warmUp(this.ai.ollama).catch(() => {}); // load the model before the first call
  }

  /** Called for every telemetry packet. */
  observe(f: Frame, s: Stats) {
    this.lastFrame = f;
    this.lastStats = s;
    const messages = this.brain.observe(f, s, this.settings, this.limits, Date.now());
    if (!this.active || !this.settings.enabled) return;
    for (const m of messages) this.deliver(m);
  }

  /** Urgent calls go out at once; the rest may be polished by the local AI first. */
  private deliver(m: Message) {
    if (!this.ai.ollama.enabled || m.priority === 3 || this.rephrasing >= 1) {
      voice.say(m);
      return;
    }
    const generation = this.generation;
    this.rephrasing++;
    rephrase(this.ai.ollama, m.text, this.facts(), 1500)
      .then((better) => { if (generation === this.generation && this.active && this.settings.enabled) voice.say(better ? { ...m, text: better } : m); })
      .catch(() => { if (generation === this.generation && this.active && this.settings.enabled) voice.say(m); })
      .finally(() => {
        this.rephrasing--;
      });
  }

  /** Rounded facts the AI may use for colour ("bagdækkene er på 97 grader"). */
  private facts(): Record<string, unknown> {
    const f = this.lastFrame;
    const s = this.lastStats;
    if (!f || !s) return {};
    return {
      omgang: f.lap,
      omgange_i_alt: f.totalLaps,
      plads: f.position > 0 ? f.position : null,
      daek_temperatur_vf_hf_vb_hb: f.tyres.map((t) => Math.round(t)),
      braendstof_omgange_tilbage: r1(s.fuelLapsLeft),
      delta_sekunder: s.delta == null ? null : Math.round(s.delta * 100) / 100,
    };
  }

  /** Everything the AI may use to answer a free question. */
  private liveData(): Record<string, unknown> {
    const f = this.lastFrame;
    const s = this.lastStats;
    if (!f || !s) return {};
    const plan = pitPlan(f, s, this.brain.pitOptions(this.settings));
    const wear = this.brain.tyreEstimate(this.settings);
    return {
      ...this.facts(),
      omgangstider_sekunder: s.lapTimes.slice(-8).map((t) => Math.round(t * 1000) / 1000),
      bedste_omgang: s.bestLap,
      seneste_omgang: s.lastLap,
      gennemsnit: r1(s.averageLap),
      aktuel_omgangstid: r1(s.currentLap),
      topfart_kmt: Math.round(s.topSpeedKmh),
      braendstof_pr_omgang_procent: r1(s.fuelPerLap),
      pitplan: plan.text,
      daek_tilbage_procent_fra_koererens_melding: wear ? Math.round(wear.remainingNow) : 'ikke meldt',
      daek_slid_pr_omgang_procent: wear ? r1(wear.perLap) : null,
      vand_grader: Math.round(f.waterTemp),
      olie_grader: Math.round(f.oilTemp),
    };
  }

  /** New race / session reset. */
  reset() {
    this.generation++;
    this.lastFrame = null;
    this.lastStats = null;
    this.brain.reset();
    voice.stop();
  }

  /**
   * Answers a question in Danish from the latest data and speaks it (unless muted).
   * Known questions are answered by the rules at once; anything else goes to the
   * local AI if it is on.
   */
  async ask(question: string): Promise<string> {
    if (!this.lastFrame || !this.lastStats) return 'Jeg har ingen data endnu. Start GT7 eller demoen.';
    const generation = this.generation;
    const command = parseTyreCommand(question);
    let text: string;
    if (command?.kind === 'report') text = this.brain.reportTyres(command.remaining, this.settings);
    else if (command?.kind === 'newTyres') text = this.brain.newTyres();
    else if (topicOf(question) === null && this.ai.ollama.enabled) {
      text = (await askOllama(this.ai.ollama, question, this.liveData())) ?? 'Jeg kan ikke få fat i AI-hjernen lige nu. Spørg fx om brændstof, dæk eller pit.';
    } else {
      text = answer(question, this.lastFrame, this.lastStats, this.limits, {
        pit: this.brain.pitOptions(this.settings),
        tyreWear: this.brain.tyreEstimate(this.settings),
        tyreChangeAt: this.settings.tyreChangeAt,
      });
    }
    if (generation !== this.generation || !this.active) return text;
    if (this.settings.enabled) voice.test(text);
    else voice.onSpeak?.(text);
    return text;
  }

  /** Stop talking (e.g. before listening to a question). */
  hush() {
    this.generation++;
    voice.stop();
  }

  set onSpeak(fn: ((text: string) => void) | null) {
    voice.onSpeak = fn;
  }

  acknowledge() { if (this.active && this.settings.enabled) voice.test('Ja?'); }

  onBusyChange(fn: (busy: boolean) => void) { return voice.onBusyChange(fn); }

  /** For the pit widget. */
  pitOptions() {
    return this.brain.pitOptions(this.settings);
  }

  /** Is RaceDeck's shared AI voice set up in this build (server address in app.json)? */
  get sharedVoiceAvailable() {
    return cloudVoice !== null;
  }

  /** Last problem with the AI voice (no key, quota used up …), for the settings screen. */
  get aiVoiceError() {
    return voice.lastError;
  }

  test() {
    voice.setRate(this.settings.rate);
    voice.test('Radiotjek. Løbsingeniøren er klar. Ny bedste omgang, 1 minut 19,8.');
  }

  /** Checks the local AI and speaks its reply. */
  async testAi(): Promise<string> {
    const generation = this.generation;
    const result = await warmUp(this.ai.ollama);
    if (result.ok) {
      if (generation !== this.generation) return result.text;
      voice.test(result.text);
      return `AI-hjernen svarede på ${(result.ms / 1000).toFixed(1).replace('.', ',')} s: “${result.text}”`;
    }
    return result.text;
  }
}

export const engineer = new RaceEngineer();
