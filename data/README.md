# Stadtteile der Stadt Essen

`Stadtteile_WGS84.geojson` is an unmodified snapshot of the Stadt Essen
open-data resource for municipal district boundaries.

## Provenance

- Publisher: Stadt Essen
- Dataset landing page: <https://data.gov.de/suche/daten/verwaltungsgrenzen-der-stadt-essen>
- Direct download: <https://opendata.essen.de/sites/default/files/Stadtteile_WGS84.geojson>
- Retrieved: 2026-07-11
- SHA-256: `92af650a09e18886566cb488718c358666ca4617a5ddde6dc14dc1ecfeb1f840`
- File size: 8,839,921 bytes

The downloaded GeoJSON file contains no licence statement or licence
identifier. Portal metadata for this resource is not consistent across the
available catalogue descriptions, so this snapshot deliberately does not
assert a licence. Check the current publisher metadata before redistributing
or reusing the data.

## Verified data characteristics

- GeoJSON type: `FeatureCollection`
- Feature count: 50
- Geometry type: `Polygon` for all 50 features
- Coordinate reference system: WGS 84 / EPSG:4326, as identified by the
  resource name and confirmed by the longitude/latitude coordinate range
- Bounding box `[west, south, east, north]`:
  `[6.894362263134793, 51.347572380296015, 7.137646224910653, 51.53422158769172]`
- Property fields: `FID`, `OBJECTID`, `LDS`, `STADTTEILE`, `STAT_NR`,
  `STADTT`, `STADTBEZ`, `Shape_Leng`, `Shape_Area`
- `STADTT` contains 50 unique values covering 1 through 50
- `STADTTEILE` contains 50 unique names, including `Stadtkern` and
  `Rellinghausen`
- Düsseldorf names `Niederkassel`, `Golzheim`, and `Derendorf` are absent

The source properties and geometry are intentionally retained exactly as
downloaded. Field mapping and geometry normalization belong in the database
import process, not in this source snapshot.
