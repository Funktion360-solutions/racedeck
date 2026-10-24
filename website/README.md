# RaceDeck produkthjemmeside

React + TypeScript + Vite. Dansk og engelsk (`?lang=en`). Egen mørkegrøn/lime visuel identitet, rigtige screenshots fra appen og fokus på den kommende App Store-lancering. Ingen lanceringsdato eller offentlig TestFlight-adresse er opfundet.

## Lokal udvikling

```sh
npm ci
npm run dev
```

Kontrol og build:

```sh
npm run build
npm run preview
```

## Vercel

Importér det private GitHub-repository og vælg **Root Directory: `website`**. Framework: Vite. Install: `npm ci`. Build: `npm run build`. Output: `dist`. `vercel.json` håndterer direkte besøg på `/privatliv` og `/privacy`. Produktsiden kræver ingen miljøvariabler. Den nye `/api/tts`-funktion er lukket som standard og kræver separat opsætning; se `../AI-OPSAETNING.md`.

## Sider og interaktioner

- `/`: produktpræsentation, screenshotvælger, FAQ og mobilmenu.
- `/privatliv`: privatlivspolitik med Magnus Slot som dataansvarlig. Dansk og engelsk.
- `/demo/`: den oprindelige, særskilte GPL-browserdemo, uændret.
- `/demo/source.zip`: demoens kildeleverance, bevaret.

Screenshots i `public/images` kommer fra Aksels IMG_7003, IMG_7004 og IMG_7005 og viser appens demodata. Skærmene er ikke browserdemoen.

## Privatliv og lancering

Privatlivspolitikken er mærket som **udkast**. `PRIVACY_REVIEW.md` beskriver de dokumenterede kodefund og de udestående oplysninger om kontakt, hosting, mail, opbevaring, AI-tjenester og overførsler. Udkastet må ikke behandles som en færdig lanceringspolitik. `noindex,nofollow` beholdes under gennemgang.

Hovedsiden bruger systemskrifter uden analyseværktøjer, reklamesporing, login eller formular. Browserdemoen bruger Google Fonts og localStorage, som er beskrevet særskilt. Kodegennemgangen erstatter ikke kontrol af leverandørkontoens indstillinger eller det faktiske release-build.

## Rettigheder

RaceDeck er udviklet af Magnus Slot og udgives gennem Funktion360. Eget materiale er omfattet af hovedprojektets proprietære `LICENSE`. Demoen og øvrige tredjepartsmaterialer beholder deres egne licenser; se `../THIRD_PARTY_NOTICES.md`. Repositoryet skal være privat, men browserkode og public-aktiver bliver tilgængelige ved offentlig webhosting.
