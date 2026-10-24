import { Fragment, useEffect, useState } from 'react';
import { danish, english, type Language, type TranslationKey } from './translations';

// Translations are local text; render the two supported formatting tags as React elements.
function formatted(text: string) {
  return text.split(/(<br>|<em>.*?<\/em>)/g).map((part, index) => (
    <Fragment key={index}>{part === '<br>' ? <br /> : part.startsWith('<em>') ? <em>{part.slice(4, -5)}</em> : part}</Fragment>
  ));
}

export default function App() {
  const [language, setLanguage] = useState<Language>(() =>
    new URLSearchParams(window.location.search).get('lang') === 'en' ? 'en' : 'da'
  );
  const t = (key: TranslationKey) => formatted((language === 'en' ? english : danish)[key]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === 'en' ? 'RaceDeck · Your cockpit. Your rules.' : 'RaceDeck · Dit cockpit. Dine regler.';
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = language === 'en'
      ? 'RaceDeck — your personal GT7 dashboard for iPhone and iPad. Developed by Magnus Slot. Published by Funktion360.'
      : 'RaceDeck — dit personlige GT7-dashboard til iPhone og iPad. Udviklet af Magnus Slot. Udgivet af Funktion360.';
  }, [language]);
  function toggleLanguage() {
    const next = language === 'da' ? 'en' : 'da';
    const url = new URL(window.location.href);
    url.searchParams.set('lang', next);
    window.history.replaceState(null, '', url);
    setLanguage(next);
  }
  return <>
<a className="skip" href="#main">Skip to content</a><header><a className="brand" href="#">▰ RaceDeck<span>BY MAGNUS SLOT</span></a><nav aria-label="Navigation"><a href="#features">{t("navFeatures")}</a><a href="#setup">{t("navSetup")}</a><a href="#questions">{t("navFaq")}</a></nav><button id="language" onClick={toggleLanguage} aria-label={language === "en" ? "Skift til dansk" : "Switch to English"}>{language === "en" ? "DA ↗" : "EN ↗"}</button></header>
<main id="main"><section className="hero"><div className="eyebrow">{t("eyebrow")}</div><h1>{t("headline")}</h1><div className="intro"><p>{t("intro")}</p><a className="button" href="demo/">{t("demo")}</a><small>{t("demoNote")}</small></div><div className="visual" aria-label="Illustrative dashboard with simulated values"><div className="visual-top"><span>RACE / 01</span><span className="signal">{t("simulated")}</span><span>RaceDeck</span></div><div className="dashboard"><div className="speed"><label>KM/H</label><strong>218</strong><span>TOP 264</span></div><div className="gear"><div className="leds">● ● ● ● ● ● ● ● ● ●</div><strong>4</strong><span>7 420 RPM</span><div className="pedal"><i></i></div></div><div className="times"><label>BEST LAP</label><strong>1:42.836</strong><label>DELTA</label><strong className="lime">−0.248</strong><label>LAP</label><strong>04 / 12</strong></div><div className="tyres"><label>TYRE TEMP °C</label><div><b>82°</b><b>84°</b><b>80°</b><b>81°</b></div></div></div><div className="visual-bottom"><span>FUEL <b>38.2 L</b></span><span>EST. <b>8.4 LAPS</b></span><span>POSITION <b>03 / 16</b></span></div></div><p className="caption">{t("caption")}</p></section>
<div className="strip"><span>{t("strip1")}</span><span>iPHONE + iPAD</span><span>{t("strip3")}</span><span>{t("strip4")}</span></div>
<section id="features"><div className="eyebrow">01 / THE TOOLKIT</div><h2>{t("featureTitle")}</h2><div className="features"><article><span>01 — LAYOUT</span><h3>{t("f1title")}</h3><p>{t("f1")}</p></article><article><span>02 — TELEMETRY</span><h3>{t("f2title")}</h3><p>{t("f2")}</p></article><article><span>03 — DRIVE</span><h3>{t("f3title")}</h3><p>{t("f3")}</p></article></div><p className="note">{t("sourceNote")}</p></section>
<section id="setup" className="setup"><div><div className="eyebrow">02 / GET CONNECTED</div><h2>{t("setupTitle")}</h2><p>{t("setupIntro")}</p></div><ol><li><h3>{t("s1title")}</h3><p>{t("s1")}</p></li><li><h3>{t("s2title")}</h3><p>{t("s2")}</p></li><li><h3>{t("s3title")}</h3><p>{t("s3")}</p></li></ol></section>
<section id="questions"><div className="eyebrow">03 / PIT WALL</div><h2>{t("faqTitle")}</h2><details><summary>{t("q1")}</summary><p>{t("a1")}</p></details><details><summary>{t("q2")}</summary><p>{t("a2")}</p><a href="demo/source.zip">{t("demoSource")}</a></details><details><summary>{t("q3")}</summary><p>{t("a3")}</p></details><details><summary>{t("q4")}</summary><p>{t("a4")}</p></details></section>
<section className="closing"><div className="eyebrow">MAKE IT YOURS</div><h2>{t("closing")}</h2><a href="demo/" className="button">{t("demo")}</a><p>{t("release")}</p></section></main>
<footer><div className="brand">▰ RaceDeck</div><p>Developed by Magnus Slot · Published by Funktion360</p><p>© 2026 Magnus Slot. <span>{t("rights")}</span></p><p className="muted">{t("trademark")}</p><p className="muted">{t("review")}</p></footer></>;
}
