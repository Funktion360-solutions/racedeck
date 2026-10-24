# Gennemgang af de tre leverede arkiver

Undersøgt 24. oktober 2026. De oprindeligt nævnte /mnt/data-stier findes ikke på denne Mac. Filerne blev fundet som lokale attachments gennem den refererede samtale og udpakket under ../review. Gennemgangen bygger på kildekode; runtime og live PS5-forbindelse er ikke verificeret.

## RaceDeck.zip

Swift/SwiftUI, Xcode-projekt og XcodeGen-konfiguration. 16 WidgetKind-varianter. Copyright © 2026 Magnus Slot, alle rettigheder forbeholdes. Projektet er ikke et Expo-projekt.

## RaceDeck 2(1).zip

Swift/SwiftUI. Udvider widgetlisten til 19: gear+omdrejninger, hastighed, omdrejninger, gear, pedaler, brændstof, kompakt brændstof, aktuel omgang, omgangstider, delta, omgangstæller, placering, løbsinfo, dæk, banekort, assistenter, motor, distance og sessionstid. Tilføjer blandt andet Racerdisplay-stil og temperaturfarveinterpolation. Filnavnet bruges ikke som bevis for udgivelsesstatus.

Kildehenvisninger i RaceDeck 2/RaceDeck:

- Model/DashLayout.swift: widgettyper, styles, standardlayouts, flytning, størrelser og lokal UserDefaults-lagring.
- Views/LayoutsView.swift: kodeeksport, ShareLink og import fra udklipsholder.
- Views/Theme.swift: fem accentfarver og racerdisplayfarver.
- Views/DriveView.swift: fuldskærmsvisning, sideskift og valgfri deaktivering af automatisk skærmlås.
- Model/AppSettings.swift: km/t eller mph, lokal IP-adresse, temperaturgrænser, brændstofreserve og lokale indstillinger.
- Telemetry/GT7Client.swift og Salsa20.swift: UDP-heartbeat til PS5 port 33739, modtagelse på 33740 og dekryptering. Kommentar om cirka 60 pakker/sekund er ikke en måling foretaget her.
- Telemetry/RaceTracker.swift: omgangsstatistik, delta, brændstofberegning og banetegning fra kørslen.
- Telemetry/DemoDriver.swift: simuleret kørsel uden PS5.
- project.yml og Config/Info.plist: iOS 17, iPhone/iPad, liggende orientering og beskrivelse af lokal netværksadgang.

Ingen package.json, app.json eller eas.json blev fundet i app-arkiverne. Fremtidig Expo-paritet er uafklaret. Koden viser lokal forbindelse og lagring; dette dokument er ikke en privatlivsvurdering af en fremtidig udgivelse.

## racedeck-demo-til-deling.zip

Indeholder RaceDeck.html og START-HER.txt. Selvstændig browserdemo med simulerede data, widgetredigering, browserlagring og indlejrede banedata. Ingen live PS5-forbindelse. Google Fonts er ekstern ressource. Demoen beskriver GPL-3.0, gt7speedboard, upstream revision 1d26962ab64fd8e339e53b9f0ee4af93b09a1297 og afledning fra en HA-prototype. Licensteksten er indlejret. Den nævner source.zip uden at ZIP-arkivet er vedlagt; website-projektet leverer et arkiv af de to faktisk modtagne filer. Det historiske prototypegrundlag og fuldstændigheden af dette kildegrundlag er ikke verificeret.

## Visuelle assets

Et AppIcon.png på 1024×1024 findes i begge app-projekter. Ingen separate screenshots, videoer eller fotografier blev fundet. Browserdemoen er i sig selv et interaktivt demo-asset. Produktwebsitets dashboard er en ny illustration med faste eksempelværdier og mærkes som sådan; det er ikke et screenshot eller live telemetri. Appikonet er ikke ændret eller genlicenseret.

## Rettigheder og offentliggørelse

Appens LICENSE forbeholder Magnus Slot rettighederne til kode, grafik og ikon. Den tidligere samtale indeholder Aksels oplysning om skriftlig tilladelse til udgivelse på Magnus’ vegne. Der er ikke indhentet eller ændret en rettighedsaftale. Produktwebsitet krediterer Magnus Slot som udvikler/ejer og Funktion360 som udgiver. Ingen Apple-, PlayStation- eller Gran Turismo-logoer er indsat.

Hjemmesiden er lokal og upubliceret. Se README.md for de konkrete udeståender før lancering.
