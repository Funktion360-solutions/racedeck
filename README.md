# RaceDeck

RaceDeck-appen og produktets hjemmeside er samlet i dette repository.

## Mapper

- Hovedmappen: Expo-appen til iPhone/iPad og Android.
- `website/`: React + TypeScript-hjemmesiden bygget med Vite.

Appen er udviklet af Magnus Slot og udgives gennem Funktion360. Se `LICENSE` og hjemmesidens egne licensoplysninger.

## Appen (Expo)

Kør fra hovedmappen:

```sh
npm ci
npm run typecheck
npx eas-cli@latest build --platform ios --profile production
```

Eksisterende Expo-projekt: `@akselslot360s-team/racedesk`.
Bundle identifier: `dk.racedeck.app`.
Production-profilen øger buildnummeret automatisk. Hjemmesiden er udeladt af EAS-upload via `.easignore`.

Upload til TestFlight er et separat trin efter godkendelse. Den lokale `.p8`-nøgle skal opbevares uden for repository; `eas.json` henviser til din lokale sti.

## Hjemmesiden lokalt

```sh
cd website
npm ci
npm run dev
```

Kontrollér produktionsbuild med `npm run build`.

## GitHub og Vercel

1. Opret et tomt repository på GitHub. Vælg **Private**. Repositoryet med den proprietære kildekode må ikke være offentligt.
2. Tilknyt repositoryet som Git remote til denne hovedmappe, og push `main`.
3. I Vercel: Add New Project → importér GitHub-repositoryet.
4. Vælg **Root Directory: `website`**.
5. Framework: **Vite**. Install: **`npm ci`**. Build: **`npm run build`**. Output: **`dist`**.
6. Gennemgå indstillingerne, og deploy, når publicering er godkendt.

Der kræves ingen miljøvariabler til den nuværende hjemmeside. Appen bygges hos Expo; Vercel bygger kun `website`.

GitHub-upload og Vercel-publicering er ikke udført som del af den lokale samling. Se `website/README.md` for hjemmesidens status og indhold, der skal afklares før lancering.

## Licens og privat kildekode

Projektets egen kode er proprietær og forbeholdt Magnus Slot, Funktion360 og særskilt autoriserede samarbejdspartnere. Se `LICENSE` for de formelle vilkår. Magnus Slot bevarer ejerskabet til appen; Funktion360 er autoriseret udgiver. Tredjepartsmateriale og GPL-browserdemoen beholder deres egne licenser; se `THIRD_PARTY_NOTICES.md`.

Et privat GitHub-repository holder repositorykoden privat. En offentlig hjemmeside leverer stadig JavaScript, HTML, CSS og public-aktiver til besøgende, herunder browserdemoens kildekode. Public-mappen må derfor aldrig indeholde fortrolig appkode eller nøgler.
