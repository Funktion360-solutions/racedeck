# RaceDeck v6 – integration

V6 er indarbejdet selektivt fra Magnus Slots RaceDeck-v6.zip. Patch-arkivet beskriver samme historik og er ikke anvendt igen oven på den fulde pakke.

## Funktioner

- 84 indbyggede banelayouts, genkendelse af kørselsretning og lokal lagring af selvtegnede baner (op til 60). Sessionnulstilling bevarer gemte baner; indstillingerne kan slette dem.
- Fælles sving mellem flere layouts vises som en mulig bane. En tvetydig banelængde bruges ikke til tidlige brændstofskøn.
- Tidlige brændstofskøn efter tilstrækkelig afstand på en genkendt bane, markeret med ≈ i dashboardet og som foreløbige i pitbeskeder. Uændret brændstof betragtes som ukendt forbrug.
- Valgfri håndfri aktivering med navnet Mads. Slået fra som standard; kræver systemtilladelse og lokal talegenkendelse. Lytter kun i kørevisning i forgrunden med ingeniøren slået til. Pause under afspilning og mikrofonknap; synlig lytteindikator. Stop ved lukning, mute eller baggrund.
- Demoens simulerede koordinater matches ikke mod virkelige baner, og demobaner gemmes ikke.

## Bevarede rettelser

Den eksisterende POST-stemmeserver, adgangskontrol, private lydcache, skjulte lokale stemmeopsætning, iOS-tilladelser og nødvendige afhængigheder er bevaret. Forsinkede AI-svar undertrykkes stadig efter mute, afslutning og nulstilling. Banedataenes medfølgende MIT-meddelelse er tilføjet uden at erstatte de eksisterende tredjepartsmeddelelser.

## Bevidste afvigelser fra Magnus’ pakke

Lydløs lydsløjfe og baggrundslytning er ikke medtaget. Der gives ikke løfte om tale/lytning med låst skærm. Taletekst og app-token sendes ikke i URL’er eller via offentlig CDN-cache.

Ollama er fortsat en valgfri lokal funktion og slået fra som standard. En fælles AI-server, som ikke kræver brugerinstallation, er ikke implementeret i denne opdatering. Den eksisterende ElevenLabs-serverfejl invalid_uid er ikke dokumenteret løst af v6.

## Kontrol

Automatiske tests dækker kortgenkendelse, korrupt lokal lagring, dubletter og grænser, brændstofskøn og tankning, demoopstart, håndfri spørgsmål, lokal genkendelse, afbrudte tilladelser, pauser og forsinkede svar. Appens og hjemmesidens TypeScript-kontrol samt iOS-konfiguration kontrolleres separat.

Ingen EAS-build, TestFlight-upload, GitHub-push eller Vercel-udgivelse foretages som del af denne integration. Håndfri aktivering, lyd og live PS5-telemetri skal afprøves på fysisk iPhone før udgivelse.
