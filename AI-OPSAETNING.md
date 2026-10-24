# RaceDeck AI — lokal integration og aktivering

Version: 24. oktober 2026. Koden er integreret lokalt; cloud-stemme og Ollama er slået fra som standard. Der er ikke lavet et nyt EAS-build eller et deploy som del af integrationen.

## Valgte komponenter

- ElevenLabs-konto med Starter valgt af Aksel.
- Foretrukket Voice ID: `TyfEd3ZWTCDCX3xmwEqC`. Tilføj stemmen til kontoens My Voices og kontrollér, at den kan bruges med API'et og den valgte model.
- Tale-model: `eleven_flash_v2_5`.
- Lokal Ollama-model: `qwen2.5:7b`.
- Mikrofon bruger kun efterspurgt lokal talegenkendelse. Hvis den ikke er tilgængelig for dansk på enheden, bruges spørgsmålsknapperne.

## Pris og grænser

Starter er aktuelt oplyst til $6/md. med 30.000 credits før skat og eventuelle rabatter. Kreditter er ikke altid lig med antal tegn, og forbruget pr. løb er ikke målt. Vercels hosting/Functions kan koste særskilt. Gratis Hobby må ikke uden videre anvendes til et kommercielt produkt.

Hold Auto Top Up slået fra. Opret en særskilt ElevenLabs-API-nøgle med kun Text to Speech og en eksplicit kreditgrænse — eksempelvis 5.000 credits til den første test. Kontroller kontoens faktiske billing- og nøgleindstillinger; ingen sætning i koden kan garantere en bestemt samlet regning. Brug aldrig en nøgle med ubegrænset adgang/kvote som fælles appnøgle.

## Før cloud-stemmen aktiveres

1. Afklar Vercel-domæne og plan samt databehandler-/privatlivsforhold.
2. Begræns testadgangen og sæt en rate-limitregel på `/api/tts` hos Vercel eller et andet dokumenteret gatewaylag. Den fælles app-token er ikke pr.-bruger-autentifikation og kan udlæses af en appbruger. Til offentlig skalering kræves stærkere bruger-/enhedsadgang og et verificeret kvotesystem.
3. Opret ElevenLabs-nøglen med den ønskede kreditgrænse og Auto Top Up slået fra.
4. Opdater privatlivsoplysningerne og sørg for et informeret valg i appen, før tekst sendes til en ekstern tjeneste.

Serveren forbliver lukket, indtil alle tre aktiveringsflag nedenfor er sat til `true`. Flagene er ejerens bekræftelse af den udførte opsætning — de etablerer ikke selv en kreditgrænse eller rate-limit. Den faktiske kreditgrænse håndhæves hos ElevenLabs; rate-limit/access skal være håndhævet i gatewayen. Sæt ikke flagene blot for at omgå 503-svaret.

## Vercel-miljøvariabler

Indtast hemmeligheder i Vercels eget dashboard under det eksisterende RaceDeck-projekt → Settings → Environment Variables. Brug Secret for API-nøgle og app-token. Indsæt ikke værdierne i chatten, GitHub, screenshots eller VITE_-variabler. Opret ikke en lokal fil med produktionshemmeligheder til dette formål.

| Navn | Værdi / formål |
|---|---|
| `ELEVENLABS_API_KEY` | Den begrænsede ElevenLabs-nøgle. Hemmelig. |
| `ELEVENLABS_VOICE_ID` | `TyfEd3ZWTCDCX3xmwEqC` |
| `ELEVENLABS_VOICE_ID_B` | Valgfri anden stemme; ellers bruges den første. |
| `ELEVENLABS_MODEL` | `eleven_flash_v2_5` |
| `RACEDECK_APP_TOKEN` | Mindst 32 tilfældige tegn. En begrænset beta-adgangskode, ikke stærk appautentifikation. |
| `RACEDECK_TTS_ENABLED` | `false` indtil opsætningen er verificeret. |
| `RACEDECK_TTS_CREDIT_LIMIT_CONFIRMED` | `false` indtil nøglens kreditgrænse er sat og kontrolleret. |
| `RACEDECK_TTS_RATE_LIMIT_READY` | `false` indtil gatewayens adgang/rate-limit er på plads. |

Deploy kun efter godkendelse. Hjemmesidens Root Directory er fortsat `website`.

## Appkonfiguration

I `app.json → expo.extra.racedeck` står nu:

```json
{ "ttsEnabled": false, "ttsUrl": "", "ttsToken": "" }
```

Når serveren er klar, bruges dens konkrete HTTPS-adresse til `/api/tts`, det samme begrænsede app-token og `ttsEnabled: true`. Den rigtige ElevenLabs API-nøgle må ALDRIG stå i `app.json`. App-tokenet er synligt i buildet og må ikke genbruges som konto-/API-nøgle.

Appens standard er telefonens stemme. Brugeren vælger Naturlig AI-stemme i indstillingerne efter opsætning. Egen ElevenLabs-nøgle er valgfri og gemmes i SecureStore; brugeren betaler da for egen konto. En egen nøgle skal slettes i appen, hvis den ikke længere skal opbevares; iOS Keychain kan have en anden levetid end almindelige appdata.

## Ollama

Installer og hent modellen på den computer, der skal køre under sessionen. Ollama installeres eller åbnes ikke automatisk af projektet. Brug kun et betroet lokalt netværk, giv kun de nødvendige lokale klienter adgang, og viderestil ikke port 11434 fra internettet.

Appen accepterer kun HTTP til lokale adresser; en fjernforbindelse kræver HTTPS. Aktivér Ollama i appindstillingerne, angiv computerens adresse, og test forbindelsen. Netværkstilladelser og mikrofon skal testes på en fysisk iPhone/iPad.

AI'en vælger kun mellem godkendte formuleringer eller understøttede emner. Autoritative tal, fortegn og råd genereres af appens regler. Akutte beskeder springer Ollama over. Dette giver ikke ubegrænsede frie racerkommentarer eller sektoranalyse.

## Build og upload er separate trin

```sh
npm test
npm run typecheck
npx eas-cli@latest build --platform ios --profile production
```

Når det nye build er godkendt, sendes netop dets ID til TestFlight med `eas submit`. Der er bevidst ikke tilføjet et auto-submit-script. Et native cloud-build og test af fysisk lyd/UDP/mikrofon mangler stadig.

## Databehandling og cache

Fælles stemme sender beskedtekst i POST-body og app-token i Authorization-header; de ligger ikke længere i URL'er. Serversvar er `no-store, private`; fejl logger ikke teksten eller nøglen. Lydfiler kan caches lokalt på telefonen. Serverfunktionen giver ingen garanti for leverandørens egen opbevaring eller nul logning.

`website/src/Privacy.tsx` og `website/PRIVACY_REVIEW.md` beskriver de valgfrie AI-funktioner og de udestående juridiske/leverandørforhold. Politikken er fortsat et udkast.

Kilder: https://elevenlabs.io/pricing · https://elevenlabs.io/docs/overview/administration/workspaces/api-keys · https://elevenlabs.io/docs/overview/administration/pay-as-you-go · https://vercel.com/docs/plans/hobby
