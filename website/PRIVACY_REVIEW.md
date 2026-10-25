# Privatliv — afklaringer før offentlig lancering

Privatlivssiden på `/privatliv` (og `?lang=en`) er et udtrykkeligt mærket udkast. Den er baseret på den aktuelle app- og websitekode, ikke på en teknisk undersøgelse af alle installerede release-builds eller leverandørkonti.

## Det koden viser

- `src/model/store.tsx` i appen lagrer layouts, indstillinger, valgt side og PS5-adresse lokalt med AsyncStorage.
- `src/telemetry/udp.ts` kommunikerer direkte med den angivne PS5-adresse. Sessionens telemetri behandles i hukommelsen.
- `src/engineer/voice.ts` bruger systemets tekst-til-tale og valgfri AI-stemme, som kan være standard ved konfigureret fælles server og understøtter valgfri ElevenLabs-tale. Mikrofon/talegenkendelse kræver aktiv brug og systemtilladelse. Ved manglende lokal talegenkendelse bruges spørgsmålsknapperne; baggrundsoptagelse er slået fra.
- Ingen brugerlogin, reklame-SDK eller analyseintegration fundet i appens kildekode. Valgfri Ollama sender udvalgte fakta/spørgsmål til den angivne computer; ElevenLabs modtager taletekst direkte eller via Vercel. Den lokale stemmeopsætning kan aktivere fælles AI-stemme i buildet. Kontoindstillinger og faktisk adgang skal kontrolleres separat.
- Hovedsiden bruger systemskrifter. Sprogvalg ligger i URL'en og giver ikke lokal cookie eller localStorage.
- Den separate, bevarede browserdemo bruger localStorage og indlæser Google Fonts. GPL-licens og demoens kildearkiv er uændrede.
- Apples TestFlight behandler test- og nedbrudsdata særskilt fra appens lokale telemetri.

## Magnus Slot / Funktion360 skal bekræfte

1. Magnus Slots kontaktoplysninger og at supportmailen kan bruges til privatlivshenvendelser; relevant kontaktadresse og faktisk fordeling af ansvar i udgivelsesaftalen.
2. Om Vercel-deploymentet har ekstra Analytics, Speed Insights, Firewall-, proxy- eller logfunktioner aktiveret uden for koden. Bekræft behandlingsvilkår, logfelter og opbevaring.
3. Mailudbyder, autoriserede supportpersoner, opbevaringsperioder og rutine for at slette supportsager og eksporteret TestFlight-feedback.
4. Hvilke modtagere/underleverandører der bruges, deres roller og eventuel behandling uden for EU/EØS samt gældende overførselsgrundlag.
5. Behandlingsgrundlagene i udkastet, herunder interesseafvejning for support, hosting og betatest. Tilpas til de reelle aftaler.
6. Den endelige vurdering af browserdemoens lokale lagring og Google Fonts. Vælg eventuelt at hoste skrifter lokalt i en særskilt, kildekonsekvent ændring.
7. At den endelige app/privacy-deklaration i App Store Connect svarer til det faktisk distribuerede build og dets afhængigheder.

Fjern først udkastmarkeringerne, når de udestående forhold er bekræftet og teksten er opdateret. En offentlig URL alene gør ikke politikken færdig.

## Kilder

- Apple: https://www.apple.com/legal/privacy/data/en/test-flight/
- Datatilsynet: https://www.datatilsynet.dk/borger/hvad-er-dine-rettigheder
- Vercel: https://vercel.com/legal/privacy-notice

8. Før AI-aktivering: bekræft ElevenLabs-vilkår, databehandling/overførsler, lydcache og slettepraksis samt informeret valg af cloud-stemme. Bekræft talegenkendelsens faktiske adfærd på fysiske enheder. Den tidligere beskrivelse uden mikrofon/AI gælder ikke længere.

## Opdatering 25. oktober 2026

Hjemmesiden angiver nu TestFlight-beta. Privatlivssiden har en særskilt dansk/engelsk oversigt over Magnus Slot/Funktion360, Vercel, ElevenLabs, den lokale Ollama-computer, Apple/TestFlight, Expo/EAS, Google Fonts i browserdemoen og den endnu ubekræftede mailudbyder. Hver post beskriver rolle, oplysninger, formål, hvornår overførslen sker, og opbevaring/udestående afklaringer.

- Kontroller den konkrete ElevenLabs-erhvervsaftale, træningsindstilling, opbevaring og overførselsgrundlag. Den almindelige privatlivspolitik undtager visse kundedatabehandlinger, som styres af erhvervsaftalen. Påstå ikke nulopbevaring eller fravalgt træning uden dokumentation.
- Kontroller Vercels faktiske region, logindstillinger, underleverandører og aftale. Private/no-store-svar er ikke ensbetydende med fravær af drifts- eller sikkerhedslogs.
- Ollama er aktuelt valgfri lokal behandling; ingen fælles cloud-AI er implementeret. Oplysninger om den lokale computers logs skal følge dens faktiske opsætning.
- EAS Build/Submit er udviklingsbehandling. EAS Update er fortsat ikke konfigureret og er ikke beskrevet som aktiv behandling af beta-brugere.
- Mikrofonens håndfri Mads-funktion kræver aktivt tilvalg og er begrænset til forgrunden. Systemtilladelser er ikke i sig selv en færdig GDPR-samtykkeløsning for cloudbehandling; afklar det faktiske informations- og tilvalgsflow.
- Beta er allerede i brug: ovenstående skal afklares for den aktuelle testbehandling, ikke først ved App Store-lancering.

Leverandørkilder kontrolleret 25. oktober 2026:
- https://vercel.com/legal/dpa
- https://vercel.com/legal/privacy-notice
- https://elevenlabs.io/privacy-policy
- https://ollama.com/privacy
- https://www.apple.com/legal/privacy/data/en/test-flight/
- https://expo.dev/privacy
- https://docs.expo.dev/eas-update/introduction/
- https://fonts.google.com/faq
