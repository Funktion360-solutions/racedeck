# Privatliv — afklaringer før offentlig lancering

Privatlivssiden på `/privatliv` (og `?lang=en`) er et udtrykkeligt mærket udkast. Den er baseret på den aktuelle app- og websitekode, ikke på en teknisk undersøgelse af alle installerede release-builds eller leverandørkonti.

## Det koden viser

- `src/model/store.tsx` i appen lagrer layouts, indstillinger, valgt side og PS5-adresse lokalt med AsyncStorage.
- `src/telemetry/udp.ts` kommunikerer direkte med den angivne PS5-adresse. Sessionens telemetri behandles i hukommelsen.
- `src/engineer/voice.ts` bruger systemets tekst-til-tale; mikrofon og baggrundsoptagelse er slået fra i appkonfigurationen.
- Ingen brugerlogin, reklame-SDK, analyseintegration eller egen telemetri-upload fundet i appens kildekode.
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
