# Urbane Datenplattform Düsseldorf – Luftqualitäts-Demo

Dies ist eine einfache Web-Demo zur Darstellung der aktuellen Luftqualität in Düsseldorf. Die Anwendung wurde im Rahmen einer Bewerbung im Bereich Geodatenmanagement erstellt.

## Funktionen

- Darstellung von Luftqualitätsdaten (NO₂, PM₁₀, PM₂.₅, O₃) auf einer interaktiven Karte
- Farbliche Kennzeichnung der Messstationen gemäß UBA-Kategorien
- Echtzeitdaten über eine eigene Proxy-Schnittstelle zum Umweltbundesamt (UBA)
- Rechte Seitenleiste mit Detailinformationen je Messstation
- Steuerung der Anzeige über Checkbox für „Luftqualität“

## Verwendete Technologien

- HTML, CSS, JavaScript
- Leaflet.js für die Kartendarstellung
- Netlify Serverless Function als API-Proxy
- Echtzeitdaten vom Umweltbundesamt (UBA)

## Projektstruktur

index.html // Hauptseite
style.css // Layout und Infopanel
airQuality.js // Hauptlogik zur Kartensteuerung
components.json // Mapping von Schadstoff-IDs zu Namen/Einheiten
netlify/functions/ubaProxy.js // Serverless Proxy für UBA-Daten


## Live-Demo

https://urbane-datenplattform-duesseldorf.netlify.app

## Lizenz

Dieses Projekt dient ausschließlich Demonstrationszwecken.
