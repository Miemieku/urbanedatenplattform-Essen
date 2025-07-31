# Urbane Datenplattform Düsseldorf – Demo

### Live-Demo
https://urbane-datenplattform-duesseldorf.netlify.app

Dieses Projekt demonstriert die grundlegende Funktionalität einer Urban Data Platform (UDP) zur Visualisierung und Analyse städtischer Geodaten. Die Anwendung wurde im Kontext einer Bewerbung bei der Stadt Düsseldorf erstellt und dient als technisches Demo zur Präsentation meiner Fähigkeiten in den Bereichen GIS, Webentwicklung und **Datenbankintegration**.

## Datenbank-Architektur & Automatisierung

### PostgreSQL/PostGIS-Datenbank (Supabase)
- **Haupttabelle**: `luftqualitaet` - Speichert alle Luftqualitätsmessungen
- **Datenbank-View**: `latest_luftqualitaet` - Optimierte Abfrage für neueste Daten pro Messstation
- **Automatische Datenaktualisierung**: Alle 30 Minuten via GitHub Actions

## Funktionen

- **Datenbankgestützte Luftqualitätsvisualisierung** (NO₂, PM₁₀, PM₂.₅, O₃) auf interaktiver Karte
- Farbliche Kennzeichnung der Messstationen gemäß UBA-Kategorien
- **Echtzeitdaten aus PostgreSQL-Datenbank** (automatisch alle 30 Minuten aktualisiert)
- Rechte Seitenleiste mit Detailinformationen je Messstation
- **24-Stunden-Historie** mit interaktiven Charts für jede Messstation
- Steuerung der Anzeige über Checkbox für „Luftqualität"
- Einbindung von Stadtteilgrenzen aus PostgreSQL/PostGIS-Datenbank


## Verwendete Technologien

- HTML, CSS, JavaScript
- Leaflet.js für die Kartendarstellung
- **Chart.js** für Datenvisualisierung
- Netlify Serverless Functions als API-Proxy
- **Supabase** (PostgreSQL + PostGIS) für Geo-Datenhaltung und Luftqualitätsdaten
- **GitHub Actions** für automatisierte Datenaktualisierung
- QGIS zur Geodatenvorbereitung

## Datenquellen

- **Luftqualitätsdaten**: Umweltbundesamt (UBA) → Supabase-Datenbank
- **Stadtteilgrenzen**: Eigene Aufbereitung auf Basis von Geojson, transformiert nach EPSG:4326

## Projektstruktur

index.html // Hauptseite
style.css // Layout und Infopanel
airQuality.js // Hauptlogik zur Kartensteuerung
components.json // Mapping von Schadstoff-IDs zu Namen/Einheiten
netlify/functions/ubaProxy.js // Serverless Proxy für UBA-Daten

## Lizenz

Dieses Projekt dient ausschließlich Demonstrationszwecken.
