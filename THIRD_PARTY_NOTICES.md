# Tredjepartslicenser

RaceDecks proprietære licens i `LICENSE` gælder kun materiale, som projektets rettighedshavere kan licensere. Tredjepartslicenser har fortsat virkning.

## Separat browserdemo

`website/public/demo/index.html` og `RaceDeck.html` indeholder GPL-3.0-tekst og kreditering af profittlich/gt7speedboard. `source.zip` indeholder den leverede demokilde og START-HER.txt. De filer og deres meddelelser er bevaret uændret. De må ikke markeres som udelukkende proprietære. Browserdemoen er adskilt fra Expo-appens kode.

Dette er ikke en verificering af det fuldstændige historiske kildegrundlag. Ved offentlig distribution skal GPL-krav og eventuelle yderligere tredjepartsrettigheder afklares for det faktisk distribuerede materiale.

## Afhængigheder og skrifter

Expo, React, React Native, Vite, UDP-modulet, øvrige npm-pakker og Barlow Condensed har egne rettighedshavere og licenser. De konkrete versioner fremgår af de to package-lock.json-filer. Se de respektive pakkers LICENSE- og NOTICE-filer for vilkårene. Medtag krævede meddelelser ved distribution.

Oversigten er ikke en udtømmende audit af alle direkte og transitive afhængigheder.


## Indbyggede banedata fra v6

### GT7 track outlines (`src/telemetry/trackdata.ts`)

The built-in track maps come from recordings in
[zetetos/gt-telemetry](https://github.com/zetetos/gt-telemetry) (`data/circuits`), as distilled in
[jbhoorasingh/gt7-datalogger-track-data](https://github.com/jbhoorasingh/gt7-datalogger-track-data) (`vendor/circuits.json`).
Track names are factual identification of Gran Turismo 7 content (Polyphony Digital / Sony Interactive Entertainment);
RaceDeck is not affiliated with or endorsed by them.

```
MIT License

Copyright (c) 2024 vwhitteron

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
