"use strict";

const fs = require("node:fs");
const path = require("node:path");

const EXPECTED_FEATURE_COUNT = 50;
const ESSEN_BOUNDS = Object.freeze({ minLon: 6.89, maxLon: 7.14, minLat: 51.34, maxLat: 51.54 });
const REQUIRED_NAMES = Object.freeze(["Stadtkern", "Rellinghausen"]);
const FORBIDDEN_NAMES = Object.freeze(["Niederkassel", "Golzheim", "Derendorf"]);
const DEFAULT_DATA_PATH = path.resolve(__dirname, "..", "data", "Stadtteile_WGS84.geojson");
const DEFAULT_LOCAL_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function normalizeNummer(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d{1,2}$/.test(raw)) throw new Error(`Invalid STADTT value: ${JSON.stringify(value)}`);
  return raw.padStart(2, "0");
}

function visitCoordinates(value, visitor) {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Geometry coordinates must be non-empty arrays");
  if (typeof value[0] === "number") {
    if (value.length < 2 || !Number.isFinite(value[0]) || !Number.isFinite(value[1])) {
      throw new Error("Geometry contains a non-finite or incomplete coordinate");
    }
    visitor(value[0], value[1]);
    return;
  }
  for (const child of value) visitCoordinates(child, visitor);
}

function validateFeatureCollection(document) {
  if (!document || document.type !== "FeatureCollection" || !Array.isArray(document.features)) {
    throw new Error("Expected a GeoJSON FeatureCollection");
  }
  if (document.features.length !== EXPECTED_FEATURE_COUNT) {
    throw new Error(`Expected ${EXPECTED_FEATURE_COUNT} Stadtteile, received ${document.features.length}`);
  }

  const names = new Set();
  const numbers = new Set();
  const rows = document.features.map((feature, index) => {
    if (!feature || feature.type !== "Feature" || !feature.properties || !feature.geometry) {
      throw new Error(`Feature ${index + 1} is incomplete`);
    }
    const name = String(feature.properties.STADTTEILE ?? "").trim();
    const district = String(feature.properties.STADTBEZ ?? "").trim();
    const nummer = normalizeNummer(feature.properties.STADTT);
    if (!name) throw new Error(`Feature ${index + 1} has no STADTTEILE value`);
    if (!district) throw new Error(`Feature ${index + 1} has no STADTBEZ value`);
    if (!/^(Polygon|MultiPolygon)$/.test(feature.geometry.type)) {
      throw new Error(`${name} has unsupported geometry type ${feature.geometry.type}`);
    }
    visitCoordinates(feature.geometry.coordinates, (lon, lat) => {
      if (lon < ESSEN_BOUNDS.minLon || lon > ESSEN_BOUNDS.maxLon ||
          lat < ESSEN_BOUNDS.minLat || lat > ESSEN_BOUNDS.maxLat) {
        throw new Error(`${name} contains a coordinate outside the Essen bounding box: ${lon}, ${lat}`);
      }
    });
    if (names.has(name)) throw new Error(`Duplicate STADTTEILE value: ${name}`);
    if (numbers.has(nummer)) throw new Error(`Duplicate STADTT value: ${nummer}`);
    names.add(name);
    numbers.add(nummer);
    return { name, nummer, district, geometry: feature.geometry };
  });

  for (const required of REQUIRED_NAMES) {
    if (!names.has(required)) throw new Error(`Expected Essen Stadtteil is missing: ${required}`);
  }
  for (let value = 1; value <= EXPECTED_FEATURE_COUNT; value += 1) {
    const expected = String(value).padStart(2, "0");
    if (!numbers.has(expected)) throw new Error(`Expected Essen STADTT value is missing: ${expected}`);
  }
  for (const forbidden of FORBIDDEN_NAMES) {
    if (names.has(forbidden)) throw new Error(`Non-Essen Stadtteil is present: ${forbidden}`);
  }
  return rows;
}

function loadBoundaryCollection(dataPath = DEFAULT_DATA_PATH) {
  return JSON.parse(fs.readFileSync(path.resolve(dataPath), "utf8"));
}

const normalizeBoundaryFeatures = validateFeatureCollection;

function assertLocalDatabaseUrl(connectionString) {
  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch (error) {
    throw new Error(`Invalid database URL: ${error.message}`);
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) throw new Error("Database URL must use the postgres protocol");
  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    throw new Error(`Refusing to connect to non-local database host: ${parsed.hostname}`);
  }
  return connectionString;
}

async function importRows(client, rows) {
  await client.query("begin");
  try {
    await client.query(`
      create temporary table stadtteilgrenzen_staging (
        name text not null,
        nummer text not null,
        stadtbez text not null,
        geometry extensions.geometry(MultiPolygon, 4326) not null
      ) on commit drop
    `);
    for (const row of rows) {
      await client.query(`
        insert into stadtteilgrenzen_staging (name, nummer, stadtbez, geometry)
        values ($1, $2, $3, extensions.st_multi(extensions.st_force2d(
          extensions.st_setsrid(extensions.st_geomfromgeojson($4), 4326)
        )))
      `, [row.name, row.nummer, row.district, JSON.stringify(row.geometry)]);
    }

    const validation = await client.query(`
      select
        count(*)::integer as count,
        count(distinct name)::integer as name_count,
        count(distinct nummer)::integer as number_count,
        bool_and(name <> '' and nummer ~ '^[0-9]{2}$' and stadtbez <> '') as fields_valid,
        bool_and(not extensions.st_isempty(geometry) and extensions.st_isvalid(geometry)) as geometries_valid,
        bool_and(extensions.st_geometrytype(geometry) = 'ST_MultiPolygon') as types_valid,
        bool_and(extensions.st_srid(geometry) = 4326) as srids_valid,
        bool_and(extensions.st_coveredby(geometry,
          extensions.st_makeenvelope(6.89, 51.34, 7.14, 51.54, 4326))) as bounds_valid
      from stadtteilgrenzen_staging
    `);
    const result = validation.rows[0];
    if (result.count !== EXPECTED_FEATURE_COUNT || result.name_count !== EXPECTED_FEATURE_COUNT ||
        result.number_count !== EXPECTED_FEATURE_COUNT || !result.fields_valid ||
        !result.geometries_valid || !result.types_valid || !result.srids_valid || !result.bounds_valid) {
      throw new Error(`Staging validation failed: ${JSON.stringify(result)}`);
    }

    await client.query(`
      insert into public.stadtteilgrenzen_geojson (name, nummer, geometry)
      select name, nummer, geometry from stadtteilgrenzen_staging order by nummer
      on conflict (nummer) do update
      set name = excluded.name, geometry = excluded.geometry
    `);
    await client.query(`
      delete from public.stadtteilgrenzen_geojson target
      where not exists (select 1 from stadtteilgrenzen_staging source where source.nummer = target.nummer)
    `);
    await client.query("commit");
  } catch (error) {
    try {
      await client.query("rollback");
    } catch (rollbackError) {
      error.rollbackError = rollbackError;
    }
    throw error;
  }
}

const replaceBoundaryFeatures = importRows;

async function run(options = {}) {
  const dataPath = path.resolve(options.dataPath || process.argv[2] || DEFAULT_DATA_PATH);
  const connectionString = assertLocalDatabaseUrl(options.connectionString || process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL || DEFAULT_LOCAL_DATABASE_URL);
  const document = loadBoundaryCollection(dataPath);
  const rows = normalizeBoundaryFeatures(document);
  const { Client } = options.pg || require("pg");
  const client = options.client || new Client({ connectionString });
  const ownsClient = !options.client;
  if (ownsClient) await client.connect();
  try {
    await importRows(client, rows);
  } finally {
    if (ownsClient) await client.end();
  }
  return { imported: rows.length, dataPath };
}

if (require.main === module) {
  run().then(({ imported, dataPath }) => console.log(`Imported ${imported} Essen Stadtteile from ${dataPath}`))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = {
  DEFAULT_DATA_PATH,
  ESSEN_BOUNDS,
  EXPECTED_FEATURE_COUNT,
  assertLocalDatabaseUrl,
  importRows,
  loadBoundaryCollection,
  normalizeNummer,
  normalizeBoundaryFeatures,
  replaceBoundaryFeatures,
  run,
  validateFeatureCollection,
  visitCoordinates
};
