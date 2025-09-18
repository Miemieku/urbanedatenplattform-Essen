# Urbane Datenplattform Essen – Demo

### Live-Demo  
👉 [https://urbane-datenplattform-essen.netlify.app/](https://urbane-datenplattform-essen.netlify.app/)

Dieses Projekt zeigt die grundlegende Funktionalität einer **Urban Data Platform (UDP)** zur Visualisierung und Analyse städtischer Geodaten.  
Es wurde im Rahmen meiner Bewerbung bei der **Stadt Essen** entwickelt und dient als **technisches Demo** meiner Kompetenzen in den Bereichen **Geodatenmanagement, Sensorintegration und digitale Stadtmodelle**.

---

## Dashboard (index.html)

Die Startseite bietet eine Übersicht zentraler urbaner Kennzahlen:

- **🌡️ Temperatur** – aktuelle Werte inkl. Min-/Max des Tages  
- **🌦️ Wetter** – gefühlte Temperatur, Luftfeuchtigkeit, Wind, Niederschlag, UV-Index, Bewölkung  
- **🚲 Fahrräder Essen (KPI)** – verfügbare Räder gesamt  
- **📊 Nextbike Stationen** – Station mit meisten freien Plätzen / wenigsten Rädern  
- **🍃 Luftqualität** – aktuelle Werte (NO₂, PM₁₀, PM₂.₅, O₃) + Kategorie (Sehr gut … Sehr schlecht)  
  - per Button „Auf Karte anzeigen“ Wechsel zur Kartenansicht mit aktivierter Luftqualitäts-Ebene  

---

## Kartenansicht (map.html)

- Interaktive Leaflet-Karte mit **Luftqualitätsstationen** und **Stadtteilgrenzen**  
- Steuerung über linke Sidebar („Daten Layer“)  
- Rechte Sidebar: Detailwerte, 24h-Historie (Chart.js), Gesundheitshinweise  

---

## Datenbank & Automatisierung

- **Supabase (PostgreSQL/PostGIS)** mit Tabellen & Views:
  - `luftqualitaet` – alle Messwerte  
  - `latest_luftqualitaet` – jeweils aktuelle Werte pro Station  
  - `luftqualitaet_24h` – Zeitreihe für Chart-Visualisierung  
  - `stadtteilgrenzen_geojson` – Stadtteilgrenzen (QGIS transformiert EPSG:4647 → EPSG:4326)  
- **Automatischer Datenimport**: GitHub Actions aktualisiert alle 30 Minuten die Luftqualitätsdaten  

---

## Funktionen

- **Interaktive Luftqualitätsvisualisierung** mit Echtzeitdaten  
- Farbliche Kennzeichnung der Stationen gemäß UBA-Kategorien  
- **24-Stunden-Historie** mit interaktiven Charts  
- **Integration von Sensordaten** (UBA-Luftqualität, Open-Meteo Wetter, Nextbike-Bike-Sharing)  
- **Stadtteilgrenzen-Overlay** aus PostGIS  
- Dashboard & Kartenansicht für Fachanwender und Bürger  

---

## Verwendete Technologien

- **Frontend**: HTML, CSS, JavaScript, Leaflet.js, Chart.js  
- **Backend**: Netlify Serverless Functions, GitHub Actions  
- **Datenbank**: Supabase (PostgreSQL + PostGIS)  
- **Geodaten**: QGIS (ETRS89 EPSG:4647 → WGS84 EPSG:4326)  
- **APIs**: Umweltbundesamt (UBA), Open-Meteo, Nextbike  

---

## Projektstruktur

urbane-datenplattform-essen/
├── public/
│   ├── index.html
│   ├── map.html
│   ├── dashboard.js
│   ├── airQuality.js
│   ├── dashboard.css
│   ├── style.css
│   ├── script.js
│   └── components.json
├── netlify/functions/
│   ├── supabaseProxy.js
│   └── ubaProxy.js
├── scripts/
│   └── fetch_uba_to_supabase.js
├── .github/workflows/
│   └── update-air-quality.yml
├── database_setup.md
├── netlify.toml
├── package.json
├── package-lock.json
└── README.md


## Datenquellen

- **Luftqualität**: Umweltbundesamt (UBA) → Supabase  
- **Geodaten**: QGIS-Aufbereitung (EPSG:4647 → EPSG:4326)  
- **Wetter**: Open-Meteo API  
- **Bike-Sharing**: Nextbike API  

---

## Bezug zur Bewerbung

Dieses Demo adressiert die Anforderungen beider ausgeschriebener Stellen:  

- **Geodatenmanagement** → Fokus auf PostgreSQL/PostGIS, QGIS-Datenaufbereitung, Datenqualität, Automatisierung  
- **Sensorik & Digitaler Zwilling** → Integration externer Sensordaten (UBA, Wetter, Nextbike), Dashboard mit Echtzeitdaten, Grundlage für Smart-City-/Digital-Twin-Anwendungen  

---

## Lizenz

Dieses Projekt dient **ausschließlich Demonstrationszwecken** im Rahmen meiner Bewerbung bei der **Stadt Essen**.  
