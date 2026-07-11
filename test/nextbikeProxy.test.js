const test = require("node:test");
const assert = require("node:assert/strict");

const { createHandler } = require("../netlify/functions/nextbikeProxy");

function responseWith(body, overrides = {}) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => body,
    ...overrides
  };
}

function validPayload() {
  return {
    countries: [{
      cities: [{
        uid: 133,
        available_bikes: 14,
        set_point_bikes: 27,
        places: [
          { name: "Station A", bikes: 1, free_racks: 0 },
          { name: "Station B", bikes: 0, free_racks: 0 }
        ]
      }]
    }]
  };
}

test("returns normalized Essen data", async () => {
  const handler = createHandler(async () => responseWith(validPayload()));
  const result = await handler({ httpMethod: "GET" });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), {
    available_bikes: 14,
    set_point_bikes: 27,
    places: [
      { name: "Station A", bikes: 1, free_racks: 0 },
      { name: "Station B", bikes: 0, free_racks: 0 }
    ]
  });
});

test("returns 502 when Nextbike responds with an error", async () => {
  const handler = createHandler(async () => responseWith({}, {
    ok: false,
    status: 503,
    statusText: "Service Unavailable"
  }));
  const result = await handler({ httpMethod: "GET" });

  assert.equal(result.statusCode, 502);
  assert.match(JSON.parse(result.body).details, /503/);
});

test("returns 502 when Essen is missing", async () => {
  const handler = createHandler(async () => responseWith({ countries: [] }));
  const result = await handler({ httpMethod: "GET" });

  assert.equal(result.statusCode, 502);
  assert.match(JSON.parse(result.body).details, /Essen city/);
});

test("returns 502 when Essen has no usable stations", async () => {
  const payload = validPayload();
  payload.countries[0].cities[0].places = [];
  const handler = createHandler(async () => responseWith(payload));
  const result = await handler({ httpMethod: "GET" });

  assert.equal(result.statusCode, 502);
  assert.match(JSON.parse(result.body).details, /no usable Essen stations/);
});

test("returns 502 when the upstream request times out", async () => {
  const handler = createHandler(async () => {
    throw new Error("network timeout at: nextbike");
  });
  const result = await handler({ httpMethod: "GET" });

  assert.equal(result.statusCode, 502);
  assert.match(JSON.parse(result.body).details, /timeout/);
});
