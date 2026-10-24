import { useEffect, useState } from 'react';
import { danish, english, type Language } from './translations';
import Privacy from './Privacy';

const images = ['/images/dashboard-standard.png', '/images/dashboard-racer.png', '/images/dashboard-drive.png'];
export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? 'M6 18 18 6M6 6h12v12' : 'M4 12h16m-6-6 6 6-6 6'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function Mark() { return <svg className="brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 25 11 7h12c7 0 6 10-1 11l4 7h-7l-4-7h-1l-2 7H5Zm11-13-1 3h6c2 0 3-3 1-3h-6Z" fill="currentColor" /></svg>; }
function FeatureArt({ index }: { index: number }) {
  if (index === 0) return <div className="feature-art mini-layout" aria-hidden="true"><span><small>KM/T</small><b>218</b></span><span><small>GEAR</small><b>4</b></span><span><small>DELTA</small><b>−0.248</b></span><span className="mini-add">+</span></div>;
  if (index === 1) return <div className="feature-art lap-art" aria-hidden="true"><div><small>BEST LAP</small><b>1:19.817</b><span>−0.346</span></div><svg viewBox="0 0 300 65"><path d="M0 48 20 45 35 50 55 28 75 33 93 14 115 20 135 42 157 32 180 38 204 14 225 20 250 9 273 21 300 5" fill="none" stroke="currentColor" strokeWidth="2" /></svg></div>;
  return <div className="feature-art sound-art" aria-hidden="true"><div className="sound-orb"><svg viewBox="0 0 24 24" fill="none"><path d="m4 9 4 0 5-4v14l-5-4H4V9Zm12-2c4 3 4 7 0 10m3-13c6 4 6 12 0 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></div><div className="wave">{Array.from({ length: 23 }, (_, i) => <i key={i} style={{ height: `${10 + ((i * 17) % 45)}px` }} />)}</div></div>;
}
export default function App() {
  const [language, setLanguage] = useState<Language>(() => new URLSearchParams(window.location.search).get('lang') === 'en' ? 'en' : 'da');
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState(0);
  const t = language === 'en' ? english : danish;
  const isPrivacy = /^\/(privatliv|privacy)\/?$/.test(window.location.pathname);
  const query = language === 'en' ? '?lang=en' : '';
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = isPrivacy ? `${t.privacy} · RaceDeck` : 'RaceDeck · ' + (language === 'da' ? 'Dit cockpit. Dit overblik.' : 'Your cockpit. Your focus.');
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (meta) meta.content = isPrivacy ? (language === 'da' ? 'Læs om RaceDecks behandling af oplysninger i appen, TestFlight og på hjemmesiden.' : 'How RaceDeck handles data in the app, TestFlight and website.') : t.intro;
  }, [language, isPrivacy, t]);
  const toggleLanguage = () => {
    const next = language === 'da' ? 'en' : 'da';
    const url = new URL(window.location.href);
    if (next === 'en') url.searchParams.set('lang', 'en'); else url.searchParams.delete('lang');
    window.history.replaceState(null, '', url);
    setLanguage(next);
  };
  const home = '/' + query;
  return <>
    <a className="skip" href="#main">{t.skip}</a>
    <div className="site-top"><span className="status-dot" /> {t.status}<span className="top-separator">/</span><span>Developed by Magnus Slot</span></div>
    <header className="site-header wrap">
      <a className="brand" href={home} aria-label="RaceDeck home"><Mark /><span>RaceDeck<span className="brand-credit">BY MAGNUS SLOT</span></span></a>
      <button className="menu-toggle" aria-expanded={menuOpen} aria-controls="main-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? t.close : t.menu}<span>{menuOpen ? '−' : '+'}</span></button>
      <nav id="main-nav" aria-label={language === 'da' ? 'Hovednavigation' : 'Main navigation'} className={menuOpen ? 'is-open' : ''}>
        <a href={`${home}#features`} onClick={() => setMenuOpen(false)}>{t.features}</a><a href={`${home}#cockpit`} onClick={() => setMenuOpen(false)}>{t.cockpit}</a><a href={`${home}#setup`} onClick={() => setMenuOpen(false)}>{t.setup}</a>
      </nav>
      <button className="language-button" onClick={toggleLanguage} aria-label={language === 'da' ? 'Switch to English' : 'Skift til dansk'}>{language === 'da' ? 'EN' : 'DA'}<span>↗</span></button>
    </header>
    {isPrivacy ? <Privacy language={language} /> : <main id="main">
      <section className="hero wrap">
        <div className="hero-copy"><p className="eyebrow"><span className="tiny-cross">+</span>{t.kicker}</p><h1>{t.title}<br /><em>{t.titleAccent}</em></h1><div className="hero-intro"><p>{t.intro}</p><div className="hero-actions"><a className="button primary" href="#cockpit">{t.explore}<Arrow /></a><a className="text-link" href="/demo/">{t.demo}<Arrow diagonal /></a></div><p className="device-note"><span className="device-icon" aria-hidden="true">▯</span>{t.deviceNote}</p></div></div>
        <div className="hero-product"><div className="product-meta"><span><i />{t.heroBadge}</span><span>RD / 01</span></div><div className="device-shell"><div className="device-camera" /><img src={images[2]} width="2622" height="1206" alt={t.screenshotAlt[2]} fetchPriority="high" /><div className="device-home" /></div><div className="product-bottom"><span>{t.heroCaption}</span><span className="mono">iOS / GT7</span></div><div className="hero-halo" aria-hidden="true" /></div>
        <div className="hero-foot"><span>{t.screenshot}</span><a href="#features" className="scroll-cue" aria-label={t.features}>↓</a></div>
      </section>
      <div className="spec-strip"><div className="wrap">{t.facts.map((fact, i) => <span key={fact}><b>0{i + 1}</b>{fact}<i aria-hidden="true">+</i></span>)}</div></div>
      <section id="features" className="section wrap"><div className="section-heading"><div><p className="eyebrow">{t.section1}</p><h2>{t.featureTitle}</h2></div><p>{t.featureIntro}</p></div><div className="feature-grid">{t.cards.map((card, i) => <article className="feature-card" key={card.n}><div className="card-label"><span>{card.label}</span><span>{card.n}</span></div><FeatureArt index={i} /><h3>{card.title}</h3><p>{card.text}</p></article>)}</div><p className="footnote">{t.estimate}</p></section>
      <section id="cockpit" className="gallery-section"><div className="wrap section"><div className="section-heading"><div><p className="eyebrow">{t.section2}</p><h2>{t.galleryTitle}</h2></div><p>{t.galleryIntro}</p></div><div className="gallery-toolbar"><div className="view-switch" role="group" aria-label={language === 'da' ? 'Vælg appvisning' : 'Choose app view'}>{t.modes.map((name, i) => <button key={name} aria-pressed={mode === i} onClick={() => setMode(i)}><span className="mode-dot" />{name}</button>)}</div><span className="gallery-count mono">0{mode + 1} <span>/ 03</span></span></div><figure className="gallery-figure"><div className="gallery-image"><img key={images[mode]} src={images[mode]} alt={t.screenshotAlt[mode]} width="2622" height="1206" loading="lazy" /></div><figcaption><strong>{t.modes[mode]}</strong><span>{t.modeDescriptions[mode]}</span><span className="gallery-corner" aria-hidden="true">↗</span></figcaption></figure><p className="footnote">{t.galleryFoot}</p></div></section>
      <section className="voice-section wrap section"><div className="voice-copy"><p className="eyebrow">{t.voiceEyebrow}</p><h2>{t.voiceTitle}</h2><p>{t.voiceText}</p><div className="tag-list">{t.voiceTags.map(tag => <span key={tag}>{tag}</span>)}</div></div><div className="voice-card"><div className="voice-card-head"><span className="status-dot" /><span>RACE ENGINEER</span><span className="voice-language">DA / DK</span></div><div className="voice-wave" aria-hidden="true">{Array.from({ length: 43 }, (_, i) => <i key={i} style={{ height: `${8 + Math.sin(i / 42 * Math.PI) * (16 + (i * 13 % 65))}px`, animationDelay: `${i * -0.13}s` }} />)}</div><blockquote>{t.voiceQuote}</blockquote><p>{t.voiceCaption}</p><div className="radio-line"><span>RACEDECK</span><span>● ● ●</span></div></div></section>
      <section id="setup" className="setup-section"><div className="wrap section"><p className="eyebrow">{t.section3}</p><div className="setup-heading"><h2>{t.setupTitle}</h2><p>{t.setupIntro}</p></div><ol className="setup-steps">{t.steps.map((step, i) => <li key={step.title}><span className="step-number">0{i + 1}<Arrow /></span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol></div></section>
      <section className="faq-section wrap section"><div><p className="eyebrow">{t.section4}</p><h2>{t.faqTitle}</h2><a className="text-link" href="mailto:racedeck@funktion360.dk">{t.contact}<Arrow diagonal /></a></div><div className="faq-list">{t.faqs.map((faq, i) => <details key={faq.q}><summary><span className="faq-number">0{i + 1}</span>{faq.q}<span className="faq-plus" aria-hidden="true">+</span></summary><div className="faq-answer"><p>{faq.a}</p>{i === 2 && <a href="/demo/source.zip">{t.source} ↗</a>}{i === 3 && <a href={`/privatliv${query}`}>{t.privacy} →</a>}</div></details>)}</div></section>
      <section className="closing-section"><div className="wrap"><p className="eyebrow">{t.closingLabel}</p><h2>{t.closingTitle}</h2><p>{t.closingText}</p><a className="button primary" href="/demo/">{t.demo}<Arrow diagonal /></a><span className="closing-outline" aria-hidden="true">R</span></div></section>
    </main>}
    <footer className="site-footer wrap"><div className="footer-top"><a className="brand" href={home}><Mark /><span>RaceDeck</span></a><p>Developed by Magnus Slot<br />Published by Funktion360</p><div className="footer-links"><a href={`/privatliv${query}`}>{t.privacy}<Arrow diagonal /></a><a href="mailto:racedeck@funktion360.dk">{t.contact}<Arrow diagonal /></a></div></div><div className="footer-bottom"><p>© 2026 Magnus Slot. {t.rights}</p><p>{t.trademark}</p></div></footer>
  </>;
}
