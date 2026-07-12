"use strict";

const { Client } = require("pg");
const { assertLocalDatabaseUrl } = require("./import_stadtteilgrenzen");

const EXPECTED_NUMBERS = Array.from(
  { length: 50 },
  (_, index) => String(index + 1).padStart(2, "0")
);

async function verifyDatabase(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  assertLocalDatabaseUrl(connectionString);

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query(`
      select
        count(*)::integer as count,
        count(distinct name)::integer as unique_names,
        count(distinct nummer)::integer as unique_numbers,
        array_agg(nummer order by nummer) as numbers,
        bool_and(extensions.st_isvalid(geometry)) as all_valid,
        bool_and(not extensions.st_isempty(geometry)) as all_nonempty,
        bool_and(extensions.st_srid(geometry) = 4326) as all_srid_4326,
        bool_and(extensions.st_geometrytype(geometry) = 'ST_MultiPolygon') as all_multipolygon,
        count(*) filter (where name in ('Stadtkern', 'Rellinghausen'))::integer as required_names,
        count(*) filter (where name in ('Niederkassel', 'Golzheim', 'Derendorf'))::integer as forbidden_names
      from public.stadtteilgrenzen_geojson
    `);

    const result = rows[0];
    const checks = {
      count: result.count === 50,
      uniqueNames: result.unique_names === 50,
      uniqueNumbers: result.unique_numbers === 50,
      exactNumbers: JSON.stringify(result.numbers) === JSON.stringify(EXPECTED_NUMBERS),
      validGeometry: result.all_valid && result.all_nonempty,
      correctGeometryContract: result.all_srid_4326 && result.all_multipolygon,
      requiredNames: result.required_names === 2,
      noDusseldorfNames: result.forbidden_names === 0
    };

    const failed = Object.entries(checks).filter(([, passed]) => !passed);
    if (failed.length) {
      throw new Error(`Database verification failed: ${failed.map(([name]) => name).join(", ")}`);
    }

    return {
      count: result.count,
      firstNumber: result.numbers[0],
      lastNumber: result.numbers.at(-1),
      geometry: "valid MultiPolygon / EPSG:4326",
      dusseldorfNames: result.forbidden_names
    };
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  verifyDatabase()
    .then((result) => console.log(`Database verified: ${JSON.stringify(result)}`))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = { EXPECTED_NUMBERS, verifyDatabase };
