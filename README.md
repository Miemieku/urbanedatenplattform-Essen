# Urbane Datenplattform Düsseldorf – Demo
### Live-Demo
https://urbane-datenplattform-duesseldorf.netlify.app

Dieses Projekt demonstriert die grundlegende Funktionalität einer Urban Data Platform (UDP) zur Visualisierung und Analyse städtischer Geodaten. Die Anwendung wurde im Kontext einer Bewerbung bei der Stadt Düsseldorf erstellt und dient als technisches Demo zur Präsentation meiner Fähigkeiten in den Bereichen GIS, Webentwicklung und Datenbankintegration.

## Funktionen

- Darstellung von Luftqualitätsdaten (NO₂, PM₁₀, PM₂.₅, O₃) auf einer interaktiven Karte
- Farbliche Kennzeichnung der Messstationen gemäß UBA-Kategorien
- Echtzeitdaten über eine eigene Proxy-Schnittstelle zum Umweltbundesamt (UBA)
- Rechte Seitenleiste mit Detailinformationen je Messstation
- Steuerung der Anzeige über Checkbox für „Luftqualität“
- Einbindung von Stadtteilgrenzen aus einer PostgreSQL/PostGIS-Datenbank (via Supabase)

## Verwendete Technologien

- HTML, CSS, JavaScript
- Leaflet.js für die Kartendarstellung
- Netlify Serverless Function als API-Proxy
- Echtzeitdaten vom Umweltbundesamt (UBA)
- Supabase (PostgreSQL + PostGIS) für Geo-Datenhaltung
- QGIS zur Geodatenvorbereitung

## Datenquellen

- Echtzeitdaten: Umweltbundesamt (Luftqualitäts-API)
- Stadtteilgrenzen: Eigene Aufbereitung auf Basis von Geojson, transformiert nach EPSG:4326

## Projektstruktur

index.html // Hauptseite
style.css // Layout und Infopanel
airQuality.js // Hauptlogik zur Kartensteuerung
components.json // Mapping von Schadstoff-IDs zu Namen/Einheiten
netlify/functions/ubaProxy.js // Serverless Proxy für UBA-Daten

## Lizenz

Dieses Projekt dient ausschließlich Demonstrationszwecken.
