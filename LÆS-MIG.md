# RaceDeck (React Native + Expo)

Dit eget GT7-dashboard med live telemetri direkte fra din PS5. Du bestemmer selv layoutet.

**Ejer:** Magnus Slot · © 2026 Magnus Slot. Alle rettigheder forbeholdes. Se `LICENSE`.

Appen er skrevet i **React Native med Expo (SDK 57) og TypeScript**. Den virker på både iPhone/iPad og Android, og du skal ikke bruge Xcode eller en Mac.

## Det kan appen

- **Live data fra GT7.** Appen forbinder direkte til PS5'en over Wi-Fi. Der er ingen server.
- **Sider, du selv bygger.** Der er 19 slags widgets, og du kan tilføje, fjerne, flytte og ændre bredde og højde. Du skifter mellem siderne med swipe under kørsel.
- **To stilarter.** *Standard* og *Racerdisplay*. Racerdisplay har sort baggrund, farvede rammer og runde LED-skiftelys, der går fra grøn over gul og rød til blå.
- **Skiftelys efter bilens egne grænser.** Lysene blinker ved bilens skiftepunkt.
- **Omgangstider.** Aktuel, seneste, bedste og gennemsnitlig omgang. **Delta** viser live, om du er foran eller bagud i forhold til din bedste omgang.
- **Brændstof.** Forbrug pr. omgang, omgange tilbage og tid tilbage.
- **Dæk.** Farverne glider fra blå over grøn og gul til rød. Standardgrænserne 60 / 85 / 95 °C bygger på spillernes egne målinger i GT7.
- **Banekort.** Banen tegnes, mens du kører. **Del sider** som en kode.
- **Format.** Appen bruges liggende, og skærmen holdes tændt under kørsel.
- **Løbsingeniør på dansk.** Han taler til dig under kørsel med telefonens egen danske stemme. Det kræver ikke internet og virker også i Expo Go. Se næste afsnit.

## Løbsingeniøren

Når **Kør** er åben, siger han korte beskeder på dansk på de rigtige tidspunkter:

| Emne | Eksempler |
|---|---|
| Omgangstider | "Ny bedste omgang! 1 minut 19,8." · "1 minut 20,4. 6 tiendedele efter din bedste." |
| Delta | Midt på omgangen: "3 tiendedele foran." · "Lige på din bedste tid." |
| Brændstof | "Brændstoffet rækker til mål." · "Brændstoffet rækker ikke til mål. Du mangler 0,6 omgang. Spar brændstof eller box." · "Brændstof kritisk. Box denne omgang!" |
| Dæk | "Fordækkene er for varme." · "Dækkene er kolde. Pas på grebet." |
| Placering | "Plads 4. Godt overhalet!" · "Du er faldet til plads 6." · "Du fører løbet!" |
| Løbet | "To omgange tilbage." · "Sidste omgang!" |

- **Indstillinger:** Under ⚙︎ → **Løbsingeniør** kan du slå hvert emne til og fra og vælge, hvor meget han snakker (Lidt / Normal / Meget). Du kan også ændre talehastigheden og teste stemmen.
- **Slå lyden fra:** Knappen 🔊 øverst i kør-tilstand slår ham fra og til.
- **Han snakker ikke for meget:** Han siger én ting ad gangen, og vigtige beskeder kommer først. Det, der er mere end 6 sekunder gammelt, springer han over. Et dæk, der bliver ved med at være varmt, nævner han ikke igen, før det har kølet af.
- **Bedre stemme:** Installér en forbedret dansk stemme på telefonen, så lyder han mere naturlig. På iPhone finder du dem under Indstillinger → Tilgængelighed → Oplæst indhold → Stemmer → Dansk.
- **Lydløs-knap:** På iPhone taler han også, selvom lydløs-knappen er slået til, og musik skrues ned, mens han taler.

## Vigtigt: Expo Go eller development build

GT7 sender telemetrien over **UDP**, og det kan **Expo Go ikke modtage**.

| | Expo Go | Development build |
|---|---|---|
| Sider, redigering, stilarter, demobil | ✅ | ✅ |
| Live data fra PS5 | ❌ | ✅ |
| Kræver | Expo Go-appen | Et gratis EAS-build i skyen |

Brug Expo Go til at bygge og prøve dine sider. Brug et development build, når du vil køre med rigtige data.

## 1. Gør projektet klar (én gang)

Du skal bruge [Node.js](https://nodejs.org) (LTS-versionen) på din computer. Windows eller Mac er lige godt.

```bash
cd racedeck-expo
npm install
npm run setup        # henter de præcise pakkeversioner, der passer til Expo SDK 57
npx expo login       # opret en gratis konto på expo.dev, hvis du ikke har en
```

## 2. Prøv appen i Expo Go

1. Installér **Expo Go** fra App Store eller Google Play, og log ind med den samme Expo-konto.
2. Kør `npm run start:go` på computeren.
3. Scan QR-koden med kameraet (iPhone) eller med Expo Go (Android). Telefonen og computeren skal være på samme Wi-Fi.

Appen starter i demotilstand.

## 3. Live data: byg et development build

```bash
npm install -g eas-cli
eas login
```

**Android (gratis):**
```bash
npm run build:android
```
EAS bygger appen i skyen og giver dig et link til en APK-fil. Åbn linket på telefonen og installér.

**iPhone/iPad:** Det kræver Apples udviklerabonnement (99 USD/år).
```bash
eas device:create    # registrér din iPhone (én gang)
npm run build:ios
```

Når appen er installeret, kører du `npm run start:dev` på computeren og åbner RaceDeck på telefonen.

Vil du have en version, der virker uden computeren, kan du bygge med `eas build --profile preview`.

## 4. Forbind til GT7

1. Find PS5'ens IP-adresse under **Indstillinger → Netværk → Forbindelsesstatus → Vis forbindelsesstatus** (IPv4-adresse).
2. I RaceDeck: tryk ⚙︎, vælg **PS5 (live)**, skriv IP-adressen og tryk **Forbind**.
3. iPhone spørger om adgang til lokalt netværk. Tryk **Tillad**.
4. Start GT7 og kør. Status skifter til **Live**, og der kommer cirka 60 pakker i sekundet.

Appen husker IP-adressen og forbinder selv næste gang. Giv gerne PS5'en en fast IP i din router, så adressen ikke ændrer sig.

## Opbygning af koden

| Mappe | Indhold |
|---|---|
| `src/engineer` | `brain.ts` (hvornår og hvad han siger), `voice.ts` (dansk stemme og kø), `index.ts` |
| `src/telemetry` | `salsa20.ts` (dekryptering), `frame.ts` (pakkeformat), `tracker.ts` (omgangstider, brændstof, delta, banekort), `udp.ts` (forbindelse og heartbeat), `demo.ts` (demobil), `hub.ts` (data til skærmen) |
| `src/model` | Sider, widgets og indstillinger. Alt gemmes på telefonen med AsyncStorage. |
| `src/ui` | Widgets, gitter, forside, kør-tilstand og dialoger |

Sådan virker protokollen: Appen sender et heartbeat (`A`) til port 33739 på PS5'en. GT7 svarer med krypterede pakker til port 33740. De dekrypteres med Salsa20.

`npm run typecheck` tjekker hele koden for typefejl.

Gran Turismo og PlayStation er varemærker tilhørende Sony Interactive Entertainment. RaceDeck er ikke tilknyttet Sony eller Polyphony Digital.
