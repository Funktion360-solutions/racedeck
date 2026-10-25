import type { Language } from './translations';

export type Recipient = {
  name: string;
  role: string;
  data: string;
  purpose: string;
  when: string;
  retention: string;
  link?: { label: string; url: string };
};
const da: Recipient[] = [
  {
    name: 'Magnus Slot og Funktion360',
    role: 'Magnus Slot er dataansvarlig. Funktion360 varetager udgivelse og teknisk administration; den præcise rollefordeling følger den faktiske aftale og skal færdigafklares.',
    data: 'Supporthenvendelser, vedhæftninger samt testdata og feedback, som Apple stiller til rådighed for appudgiveren.',
    purpose: 'Support, fejlretning, administration og forbedring af betaversionen.',
    when: 'Når du kontakter support eller deltager i TestFlight-testen. Ingen fjernadgang til dine lokale layouts eller fulde telemetrisessioner er implementeret.',
    retention: 'Adgang begrænses til autoriserede personer med et arbejdsbetinget behov. Konkrete slettefrister for support og eksporteret feedback er endnu ikke fastlagt.'
  },
  {
    name: 'Vercel',
    role: 'Hosting- og API-leverandør. Behandler kundedata efter de relevante aftaler; egne konto- og sikkerhedsformål kan være omfattet af Vercels egne vilkår.',
    data: 'IP-adresse, forespurgt adresse og tekniske forbindelses- og sikkerhedsoplysninger. Ved fælles AI-stemme også beskedtekst, stemmevalg og lyd som passerer serveren.',
    purpose: 'Levering af hjemmesiden, beskyttelse mod misbrug og videresendelse af taletekst til ElevenLabs.',
    when: 'Ved besøg på hjemmesiden og ved brug af fælles AI-stemme. Ved egen ElevenLabs-nøgle går taleteksten direkte fra appen til ElevenLabs.',
    retention: 'Stemmesvar har private/no-store-headere; det er ikke et løfte om ingen udbyderlogs. Den konkrete logopbevaring, behandlingsregion og aftaleopsætning skal bekræftes.',
    link: { label: 'Vercels databehandlingsvilkår', url: 'https://vercel.com/legal/dpa' }
  },
  {
    name: 'ElevenLabs',
    role: 'Leverandør af syntetisk tale. Rolle og vilkår afhænger af fælles erhvervsaftale eller din egen konto. Den konkrete aftale for fælles stemme skal bekræftes.',
    data: 'Den tekst, der skal læses op, stemme-ID, taleindstillinger og tekniske API-oplysninger. Teksten kan indeholde spilfakta. Appen sender ikke din rå mikrofonoptagelse til ElevenLabs.',
    purpose: 'Omdanne beskedtekst til en lydfil med en naturlig stemme.',
    when: 'Kun ved brug af AI-stemme, når lyd ikke allerede findes i appens lokale cache. Fælles stemme går via Vercel; egen nøgle bruges direkte hos ElevenLabs.',
    retention: 'Genereret lyd caches lokalt. Opbevaring hos ElevenLabs, eventuel anvendelse til modeltræning og internationale overførsler afhænger af aftale og kontoindstillinger; vi har ikke verificeret nulopbevaring eller fravalgt træning.',
    link: { label: 'ElevenLabs’ privatlivspolitik og afgrænsning for erhvervskunder', url: 'https://elevenlabs.io/privacy-policy' }
  },
  {
    name: 'Ollama på din valgte computer',
    role: 'Valgfri lokal modelserver, ikke en fælles cloudtjeneste fra RaceDeck. Den, der driver den valgte computer, kan have adgang til dens forespørgsler og logs.',
    data: 'Udvalgte spilfakta, beskeder og spørgsmålstekst. Ingen rå mikrofonoptagelse.',
    purpose: 'Vælge blandt godkendte formuleringer og forstå understøttede spørgsmål.',
    when: 'Kun hvis du aktiverer Ollama og angiver en server. Med en lokalt afviklet model behandles forespørgsler på den computer; Ollamas cloud er ikke integreret i RaceDeck.',
    retention: 'Lokal lagring og logs afhænger af computerens opsætning. Brug en computer, du har tillid til. En ændring til en fælles AI-server kræver en opdateret beskrivelse.',
    link: { label: 'Ollamas beskrivelse af lokal behandling og cloud', url: 'https://www.ollama.com/privacy' }
  },
  {
    name: 'Apple / TestFlight og iOS',
    role: 'Platformleverandør med egen behandling efter Apples vilkår. RaceDeck behandler de testoplysninger, Apple deler med appudgiveren.',
    data: 'Build- og enhedsoplysninger, brug, nedbrud og indsendt feedback; navn/e-mail afhænger af invitationen. Mikrofon og lokal talegenkendelse styres af iOS-tilladelser.',
    purpose: 'Distribution af betaversioner, fejlfinding og den valgte talegenkendelse.',
    when: 'Under TestFlight-test indsamles testdata automatisk af Apple. Mikrofon bruges ved knappen eller valgfri Mads-aktivering. Talegenkendelsen anmodes udført på enheden.',
    retention: 'Apple styrer opbevaring i sin tjeneste. Stop testen for at ophøre med fremtidig testdeltagelse. Sletning af appen er ikke en garanti for sletning af tidligere testdata eller sikkerhedskopier.',
    link: { label: 'TestFlight og privatliv', url: 'https://www.apple.com/legal/privacy/data/en/test-flight/' }
  },
  {
    name: 'Expo / EAS',
    role: 'Udviklings- og buildleverandør. Ikke en fælles AI-server.',
    data: 'Projektkilde, konfiguration, afhængigheder, buildlogs og udviklerkontooplysninger behandles ved EAS Build og Submit. Det er adskilt fra brugernes live PS5-telemetri.',
    purpose: 'Bygge og sende appversioner til Apple.',
    when: 'Når udviklerne bygger eller uploader appen. EAS Update er ikke konfigureret i den gennemgåede version; automatisk opdateringshentning via den tjeneste beskrives derfor ikke som aktuel brugerbehandling.',
    retention: 'Build- og kontodata følger den konkrete Expo-konto og dens vilkår. Hvis EAS Update eller Observe aktiveres senere, skal modtagere og brugerdata vurderes igen.',
    link: { label: 'Expos privatlivspolitik', url: 'https://expo.dev/privacy' }
  },
  {
    name: 'Google Fonts – kun browserdemoen',
    role: 'Ekstern skrifttjeneste efter Googles vilkår.',
    data: 'Tekniske HTTP-oplysninger, herunder IP-adresse og browseroplysninger, når skrifter hentes.',
    purpose: 'Vise demoens skrifttyper.',
    when: 'Når den separate browserdemo henter eksterne skrifter. Produkthjemmesiden bruger systemskrifter; appens skrifter leveres med appen.',
    retention: 'Vi har ikke verificeret en bestemt opbevaringsperiode for denne opsætning. Demoens eksterne skrifter indgår fortsat i afklaringerne før offentlig lancering.',
    link: { label: 'Google Fonts FAQ', url: 'https://fonts.google.com/faq' }
  },
  {
    name: 'Supportmailens udbyder',
    role: 'Mailleverandør; konkret leverandør og databehandlingsaftale er endnu ikke bekræftet.',
    data: 'Afsenderadresse, eventuelt navn, besked, vedhæftninger og tekniske mailoplysninger.',
    purpose: 'Modtage og besvare support- og privatlivshenvendelser.',
    when: 'Når du skriver til racedeck@funktion360.dk.',
    retention: 'Leverandør, behandlingslande, adgang og konkrete slettefrister skal afklares. Send ikke API-nøgler, adgangskoder eller unødvendige følsomme oplysninger.'
  }
];
const en: Recipient[] = [
  { name: 'Magnus Slot and Funktion360', role: 'Magnus Slot is the controller. Funktion360 handles publishing and technical administration; the precise allocation of roles must be confirmed in the actual agreement.', data: 'Support messages, attachments and the testing data and feedback Apple makes available to the app provider.', purpose: 'Support, troubleshooting, administration and beta improvements.', when: 'When you contact support or participate in TestFlight. Remote access to your local layouts or full telemetry sessions is not implemented.', retention: 'Access is limited to authorised people with a work-related need. Specific deletion periods for support and exported feedback have not yet been established.' },
  { name: 'Vercel', role: 'Hosting and API provider. Customer data is handled under the applicable agreements; separate account and security purposes may be governed by Vercel’s own terms.', data: 'IP address, requested URL and technical connection/security data. Shared AI voice also sends message text, voice selection and audio through the server.', purpose: 'Deliver the website, prevent abuse and forward speech text to ElevenLabs.', when: 'Website visits and shared AI voice. With your own ElevenLabs key, text goes directly from the app to ElevenLabs.', retention: 'Voice responses use private/no-store headers, which do not guarantee absence of provider logs. Actual log retention, processing region and contract settings require confirmation.', link: { label: 'Vercel Data Processing Addendum', url: 'https://vercel.com/legal/dpa' } },
  { name: 'ElevenLabs', role: 'Synthetic speech provider. Roles and terms depend on the shared business agreement or your own account. The agreement for shared voice requires confirmation.', data: 'Speech text, voice ID, speech settings and technical API data. Text may contain game facts. RaceDeck does not send your raw microphone recording to ElevenLabs.', purpose: 'Convert message text into natural-sounding audio.', when: 'AI voice when audio is not already cached locally. Shared voice uses Vercel; your own key connects directly to ElevenLabs.', retention: 'Audio is cached locally. Provider retention, potential model training and international transfers depend on agreement and account settings. Zero retention and a training opt-out have not been verified.', link: { label: 'ElevenLabs privacy policy and business-customer scope', url: 'https://elevenlabs.io/privacy-policy' } },
  { name: 'Ollama on your selected computer', role: 'Optional local model server, not a shared RaceDeck cloud service. The operator of that computer may access requests and logs.', data: 'Selected game facts, messages and question text, not raw microphone recordings.', purpose: 'Select approved wording and interpret supported questions.', when: 'Only when you enable Ollama and specify a server. A locally running model processes requests on that computer. Ollama cloud is not integrated into RaceDeck.', retention: 'Local retention and logs depend on the computer configuration. Use a trusted computer. A shared AI server would require an updated disclosure.', link: { label: 'Ollama local and cloud privacy information', url: 'https://www.ollama.com/privacy' } },
  { name: 'Apple / TestFlight and iOS', role: 'Platform provider with its own processing under Apple’s terms. RaceDeck handles testing data Apple shares with the app provider.', data: 'Build/device details, usage, crashes and submitted feedback; name/email depend on invitation type. iOS permissions control microphone and on-device recognition.', purpose: 'Beta distribution, troubleshooting and selected speech recognition.', when: 'Apple automatically collects testing data during TestFlight testing. The microphone is used with the button or optional Mads activation. Recognition is requested on-device.', retention: 'Apple controls retention in its service. Leave the beta to end future participation. Deleting the app does not guarantee removal of earlier testing data or backups.', link: { label: 'TestFlight & Privacy', url: 'https://www.apple.com/legal/privacy/data/en/test-flight/' } },
  { name: 'Expo / EAS', role: 'Development and build provider, not a shared AI server.', data: 'Project source, configuration, dependencies, build logs and developer account data during EAS Build and Submit, separate from users’ live PS5 telemetry.', purpose: 'Build and submit app versions to Apple.', when: 'Developer builds and uploads. EAS Update is not configured in the reviewed version, so automatic downloads from that service are not described as current user processing.', retention: 'Build/account data follows the actual Expo account and terms. Enabling EAS Update or Observe would require a renewed assessment.', link: { label: 'Expo privacy policy', url: 'https://expo.dev/privacy' } },
  { name: 'Google Fonts – browser demo only', role: 'External font service under Google’s terms.', data: 'Technical HTTP data including IP address and browser information when fonts are requested.', purpose: 'Display demo fonts.', when: 'The separate browser demo requests external fonts. The main website uses system fonts; app fonts are bundled.', retention: 'A specific retention period for this setup has not been verified. External demo fonts remain part of the pre-launch review.', link: { label: 'Google Fonts FAQ', url: 'https://fonts.google.com/faq' } },
  { name: 'Support email provider', role: 'Mail service; the actual provider and processing agreement remain unconfirmed.', data: 'Sender address, optional name, message, attachments and technical mail data.', purpose: 'Receive and answer support and privacy enquiries.', when: 'When emailing racedeck@funktion360.dk.', retention: 'Provider, processing countries, access and specific deletion periods require confirmation. Do not send API keys, passwords or unnecessary sensitive data.' }
];
export const getRecipients = (language: Language): Recipient[] => language === 'en' ? en : da;
