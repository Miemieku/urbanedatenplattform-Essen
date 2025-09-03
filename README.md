# Urbane Datenplattform Essen – Demo

### Live-Demo
https://urbane-datenplattform-essen.netlify.app/

Dieses Projekt demonstriert die grundlegende Funktionalität einer Urban Data Platform (UDP) zur Visualisierung und Analyse städtischer Geodaten. Die Anwendung wurde im Kontext einer Bewerbung bei der Stadt Düsseldorf erstellt und dient als technisches Demo zur Präsentation meiner Fähigkeiten in den Bereichen GIS, Webentwicklung und **Datenbankintegration**.

## Datenbank-Architektur & Automatisierung

### PostgreSQL/PostGIS-Datenbank (Supabase)
- **Haupttabelle**: `luftqualitaet` - Speichert alle Luftqualitätsmessungen
- **Datenbank-View**: `latest_luftqualitaet` - Optimierte Abfrage für neueste Daten pro Messstation
- **Datenbank-View**: `luftqualitaet_24h` - 24-Stunden-Historie für Chart-Visualisierung
- **Geodaten-Tabelle**: `stadtteilgrenzen_geojson` - Stadtteilgrenzen (QGIS-aufbereitet)
- **Automatische Datenaktualisierung**: Alle 30 Minuten via GitHub Actions

### Automatisierter Datenfluss
1. **Luftqualitätsdaten**:
   - **Datenimport**: GitHub Actions führt alle 30 Minuten `fetch_uba_to_supabase.js` aus
   - **Datenspeicherung**: Luftqualitätsdaten werden automatisch in PostgreSQL-Tabelle gespeichert
   - **Datenabfrage**: 
     - Frontend nutzt `latest_luftqualitaet` View für Kartenanzeige
     - Frontend nutzt `luftqualitaet_24h` View für Chart-Visualisierung

2. **Geodaten-Verarbeitung**:
   - **QGIS-Aufbereitung**: Stadtteilgrenzen werden in QGIS von EPSG:4647 nach EPSG:4326 transformiert
   - **Datenbankimport**: Aufbereitete Geodaten werden in PostgreSQL/PostGIS-Tabelle gespeichert
   - **Frontend-Anzeige**: Geodaten werden über Supabase-Proxy an Leaflet.js-Karte geliefert


## Funktionen

- **Datenbankgestützte Luftqualitätsvisualisierung** (NO₂, PM₁₀, PM₂.₅, O₃) auf interaktiver Karte
- Farbliche Kennzeichnung der Messstationen gemäß UBA-Kategorien
- **Echtzeitdaten aus PostgreSQL-Datenbank** (automatisch alle 30 Minuten aktualisiert)
- Rechte Seitenleiste mit Detailinformationen je Messstation
- **24-Stunden-Historie** mit interaktiven Charts für jede Messstation (basierend auf `luftqualitaet_24h` View)
- **Stadtteilgrenzen-Overlay** (QGIS-aufbereitet und in PostgreSQL/PostGIS gespeichert)
- Steuerung der Anzeige über Checkbox für „Luftqualität"


## Verwendete Technologien
- **Frontend**: HTML, CSS, JavaScript, Leaflet.js, Chart.js
- **Datenbank**: Supabase (PostgreSQL + PostGIS)
- **Geodaten**: QGIS (Koordinatentransformation EPSG:4647 → EPSG:4326)
- **Backend**: Netlify Serverless Functions, GitHub Actions


## Projektstruktur

```
urbane-datenplattform-Duesseldorf/
├── public/
│   ├── index.html              // Frontend-Hauptseite
│   ├── style.css               // Layout und Infopanel
│   ├── airQuality.js           // Frontend-Logik mit Datenbankanbindung
│   ├── components.json         // Schadstoff-Mapping
│   └── Stadtteilgrenzen_2025_ETRS89_EPSG4326.geojson  // QGIS-aufbereitete Geodaten
├── netlify/functions/
│   ├── supabaseProxy.js        // Sichere Datenbank-API für Frontend
│   └── ubaProxy.js             // UBA-API-Proxy (Fallback)
├── scripts/
│   └── fetch_uba_to_supabase.js // Automatisierter Datenimport UBA → PostgreSQL
└── .github/workflows/
    └── update-air-quality.yml   // Datenbank-Aktualisierung alle 30 Minuten
```
## Datenquellen

- **Luftqualitätsdaten**: Umweltbundesamt (UBA) → Supabase-Datenbank
- **Stadtteilgrenzen**: Eigene Aufbereitung auf Basis von Geojson, transformiert nach EPSG:4326
  
## Lizenz

Dieses Projekt dient ausschließlich Demonstrationszwecken.
