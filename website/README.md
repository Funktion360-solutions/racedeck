# RaceDeck produktwebsite

Lokal, upubliceret version til gennemgang. Dansk og engelsk via sprogknappen eller `?lang=en`. Domæne valgt af Aksel: https://racedeck.funktion360.dk. Der er ikke foretaget DNS-ændringer eller deployment.

## TypeScript-projekt: udvikling og hosting

Hjemmesiden er nu React + TypeScript med Vite. Appens SwiftUI-kode bruges kun som reference i filgennemgangen og indgår ikke i website-projektet.

Kør fra projektmappen:

```sh
npm ci
npm run dev
```

Produktionskontrol og build:

```sh
npm run typecheck
npm run build
npm run preview
```

Publicér `dist` efter build. Ingen DNS-ændringer eller publicering er udført.

- `src/App.tsx`: React-hjemmeside og sprogskift.
- `src/translations.ts`: typede danske og engelske tekster.
- `src/main.tsx`: React-opstart.
- `src/style.css`: responsivt design.
- `public/demo`: separat original browserdemo med egen licens og kildearkiv. Demoen er fortsat HTML/JavaScript, så originalen og licensoplysningerne bevares uændret.

Produktwebsitet bruger systemskrifter og har ingen formular, analyseværktøjer eller cookies implementeret. Browserdemoen bruger Google Fonts. Hostingens behandling og logning er ikke afklaret.

## Før publicering

- Bekræft endelig udgivelsesversions funktioner og enhedskrav, især efter portering til Expo. Ingen native app er bygget eller testet her.
- Oplys supportmail og godkend supportflow. Ingen falsk kontaktformular er oprettet.
- Oplys TestFlight-/App Store-link samt status og eventuel pris. Siden lover ikke adgang eller en lanceringsdato.
- Afklar faktisk databehandling i den endelige app, hosting, support, eventuel betaling og analyse. Skriv derefter en korrekt dansk/engelsk privatlivsside og eventuelle vilkår. Der er ikke skrevet en uunderbygget privatlivspolitik.
- Gennemgå demoens upstream-kilder og kildeleverance inden offentlig distribution. Demoens egen tekst omtaler et HA-prototypegrundlag; dette er ikke med i ZIP-filen. Det komplette historiske kildegrundlag er derfor ikke verificeret her. Licenser og credits er bevaret.
- Godkend tekst/design og demoens danske sprog. Tilføj eventuelt rigtige screenshots fra den færdige app.
- Vælg hosting og tilslut det aftalte domæne. Fjern `noindex,nofollow` og anmeldelsen i footer, når siden er godkendt til offentlig lancering. Tilføj canonical/hreflang og socialt delingsbillede efter valg af offentlig URL.

## Ophavsret

Magnus Slot er appens udvikler og ophavsretlige ejer. Funktion360 er udgiver. Ingen appfiler eller eksisterende LICENSE-filer er ændret. `APP-LICENSE.reference.txt` er en uændret referencekopi. Websitekoden ændrer ikke appens ejerskab eller licens. Demoen beholder egne GPL-3.0-oplysninger; appens rettighedstekst anvendes ikke som erstatning for demoens licens.

## Kontrol udført

TypeScript-kontrol med strict-indstilling og produktionsbuild er bestået (`npm run build`). Alle 44 oversættelsesfelter har dansk og engelsk tekst med fælles typenøgler. Demoen er byte-identisk med den modtagne HTML-fil. Visuel browserkontrol er fortsat ikke verificeret.
