const test = require("node:test");
const assert = require("node:assert/strict");

const {
  loadBoundaryCollection,
  normalizeBoundaryFeatures,
  replaceBoundaryFeatures
} = require("../scripts/import_stadtteilgrenzen");

const collection = loadBoundaryCollection();

function withFeature(index, replacement) {
  const features = collection.features.slice();
  features[index] = replacement;
  return { ...collection, features };
}

function sqlText(call) {
  return String(call.sql).replace(/\s+/g, " ").trim().toLowerCase();
}

function validDatabaseValidation(overrides = {}) {
  return {
    count: 50,
    name_count: 50,
    number_count: 50,
    fields_valid: true,
    geometries_valid: true,
    types_valid: true,
    srids_valid: true,
    bounds_valid: true,
    ...overrides
  };
}

function recordingClient({ failWhen, validation = validDatabaseValidation() } = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      const call = { sql, params };
      calls.push(call);
      const normalized = sqlText(call);
      if (failWhen?.(normalized, calls.length)) throw new Error("simulated database failure");
      if (normalized.startsWith("select count(*)")) return { rows: [validation] };
      return { rows: [], rowCount: 0 };
    }
  };
}

test("official source contains exactly the 50 Essen Stadtteile and expected fields", () => {
  assert.equal(collection.type, "FeatureCollection");
  assert.equal(collection.features.length, 50);

  const expectedFields = [
    "FID", "OBJECTID", "LDS", "STADTTEILE", "STAT_NR",
    "STADTT", "STADTBEZ", "Shape_Leng", "Shape_Area"
  ].sort();
  for (const feature of collection.features) {
    assert.equal(feature.type, "Feature");
    assert.deepEqual(Object.keys(feature.properties).sort(), expectedFields);
  }
});

test("STADTT 1 through 50 maps to zero-padded nummer 01 through 50", () => {
  const rows = normalizeBoundaryFeatures(collection);

  assert.deepEqual(
    rows.map((row) => row.nummer).sort(),
    Array.from({ length: 50 }, (_, index) => String(index + 1).padStart(2, "0"))
  );
});

test("normalization maps the official source fields without losing geometry", () => {
  const rows = normalizeBoundaryFeatures(collection);

  for (const feature of collection.features) {
    const row = rows.find((candidate) => candidate.nummer === String(feature.properties.STADTT).padStart(2, "0"));
    assert.deepEqual(row, {
      name: feature.properties.STADTTEILE,
      nummer: String(feature.properties.STADTT).padStart(2, "0"),
      district: String(feature.properties.STADTBEZ),
      geometry: feature.geometry
    });
  }
});

test("official data preserves Essen Unicode names and excludes Düsseldorf samples", () => {
  const names = new Set(collection.features.map((feature) => feature.properties.STADTTEILE));

  for (const name of ["Rüttenscheid", "Südviertel", "Margarethenhöhe", "Überruhr-Holthausen", "Schönebeck"]) {
    assert.equal(names.has(name), true, `missing Unicode sample ${name}`);
  }
  for (const name of ["Düsseldorf", "Niederkassel", "Golzheim", "Derendorf"]) {
    assert.equal(names.has(name), false, `unexpected Düsseldorf sample ${name}`);
  }
});

test("official coordinates have the documented Essen bounding box", () => {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (coordinates) => {
    if (typeof coordinates[0] === "number") {
      bounds[0] = Math.min(bounds[0], coordinates[0]);
      bounds[1] = Math.min(bounds[1], coordinates[1]);
      bounds[2] = Math.max(bounds[2], coordinates[0]);
      bounds[3] = Math.max(bounds[3], coordinates[1]);
      return;
    }
    coordinates.forEach(visit);
  };
  collection.features.forEach((feature) => visit(feature.geometry.coordinates));

  assert.deepEqual(bounds, [
    6.894362263134793,
    51.347572380296015,
    7.137646224910653,
    51.53422158769172
  ]);
});

test("normalization rejects duplicate names and STADTT numbers", () => {
  const duplicate = {
    ...collection.features[0],
    properties: { ...collection.features[0].properties }
  };

  assert.throws(
    () => normalizeBoundaryFeatures(withFeature(collection.features.length - 1, duplicate)),
    /Duplicate (?:STADTTEILE|STADTT)/
  );
});

test("normalization rejects a 51-feature collection", () => {
  const extra = {
    ...collection.features[0],
    properties: {
      ...collection.features[0].properties,
      STADTTEILE: "Not an official Stadtteil",
      STADTT: 51
    }
  };

  assert.throws(
    () => normalizeBoundaryFeatures({ ...collection, features: [...collection.features, extra] }),
    /Expected 50 Stadtteile, received 51/
  );
});

test("normalization rejects unsupported and out-of-bounds geometry", () => {
  const original = collection.features[0];
  assert.throws(
    () => normalizeBoundaryFeatures(withFeature(0, {
      ...original,
      geometry: { type: "Point", coordinates: [7.01, 51.45] }
    })),
    /unsupported geometry/i
  );

  assert.throws(
    () => normalizeBoundaryFeatures(withFeature(0, {
      ...original,
      geometry: {
        type: "Polygon",
        coordinates: [[[7.5, 51.4], [7.5, 51.41], [7.51, 51.4], [7.5, 51.4]]]
      }
    })),
    /outside the Essen bounding box/i
  );
});

test("database replacement stages all rows, upserts, deletes stale rows, and commits", async () => {
  const rows = normalizeBoundaryFeatures(collection);
  const client = recordingClient();

  await replaceBoundaryFeatures(client, rows);

  const statements = client.calls.map(sqlText);
  assert.equal(statements[0], "begin");
  assert.equal(statements.at(-1), "commit");
  assert.equal(statements.includes("rollback"), false);
  assert.equal(statements.filter((sql) => sql.startsWith("insert into stadtteilgrenzen_staging")).length, 50);
  assert.ok(statements.some((sql) =>
    sql.includes("insert into public.stadtteilgrenzen_geojson") &&
    sql.includes("on conflict (nummer) do update")
  ));
  assert.ok(statements.some((sql) =>
    sql.includes("delete from public.stadtteilgrenzen_geojson") &&
    sql.includes("where not exists")
  ));

  const firstInsert = client.calls.find((call) => sqlText(call).startsWith("insert into stadtteilgrenzen_staging"));
  assert.deepEqual(firstInsert.params.slice(0, 3), [rows[0].name, rows[0].nummer, rows[0].district]);
  assert.deepEqual(JSON.parse(firstInsert.params[3]), rows[0].geometry);
});

test("database replacement rolls back and rethrows when a write fails", async () => {
  const rows = normalizeBoundaryFeatures(collection);
  const client = recordingClient({
    failWhen: (sql) => sql.startsWith("insert into stadtteilgrenzen_staging")
  });

  await assert.rejects(
    replaceBoundaryFeatures(client, rows),
    /simulated database failure/
  );

  const statements = client.calls.map(sqlText);
  assert.equal(statements[0], "begin");
  assert.equal(statements.at(-1), "rollback");
  assert.equal(statements.includes("commit"), false);
  assert.equal(statements.some((sql) => sql.includes("insert into public.stadtteilgrenzen_geojson")), false);
  assert.equal(statements.some((sql) => sql.includes("delete from public.stadtteilgrenzen_geojson")), false);
});

test("database replacement rolls back before touching the target table when staging validation fails", async () => {
  const rows = normalizeBoundaryFeatures(collection);
  const client = recordingClient({
    validation: validDatabaseValidation({ geometries_valid: false })
  });

  await assert.rejects(
    replaceBoundaryFeatures(client, rows),
    /Staging validation failed/
  );

  const statements = client.calls.map(sqlText);
  assert.equal(statements[0], "begin");
  assert.equal(statements.at(-1), "rollback");
  assert.equal(statements.includes("commit"), false);
  assert.equal(statements.some((sql) => sql.includes("insert into public.stadtteilgrenzen_geojson")), false);
  assert.equal(statements.some((sql) => sql.includes("delete from public.stadtteilgrenzen_geojson")), false);
});
