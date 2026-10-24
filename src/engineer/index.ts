// RaceDeck
// Copyright © 2026 Magnus Slot. Alle rettigheder forbeholdes.

import type { Frame } from '../telemetry/frame';
import type { Stats } from '../telemetry/tracker';
import { EngineerBrain, EngineerSettings, TyreLimits, defaultEngineer } from './brain';
import { voice } from './voice';

/**
 * The race engineer. It always watches the telemetry (so it never replays old
 * news), but only talks while drive mode is open and it is switched on.
 */
class RaceEngineer {
  private brain = new EngineerBrain();
  private settings: EngineerSettings = defaultEngineer;
  private limits: TyreLimits = { tyreCold: 60, tyreHot: 95 };
  private active = false;

  configure(settings: EngineerSettings, limits: TyreLimits) {
    this.settings = settings;
    this.limits = limits;
    voice.setRate(settings.rate);
    if (!settings.enabled) voice.stop();
  }

  /** Drive mode opens/closes. */
  setActive(active: boolean) {
    this.active = active;
    if (!active) voice.stop();
  }

  /** Called for every telemetry packet. */
  observe(f: Frame, s: Stats) {
    const messages = this.brain.observe(f, s, this.settings, this.limits, Date.now());
    if (!this.active || !this.settings.enabled) return;
    for (const m of messages) voice.say(m);
  }

  /** New race / session reset. */
  reset() {
    this.brain.reset();
    voice.stop();
  }

  test() {
    voice.setRate(this.settings.rate);
    voice.test('Radiotjek. Løbsingeniøren er klar. Ny bedste omgang, 1 minut 19,8.');
  }
}

export const engineer = new RaceEngineer();
