const test = require("node:test");
const assert = require("node:assert/strict");

const { createHandler } = require("../netlify/functions/supabaseProxy");

const ENV = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_KEY: "test-service-key"
};

function upstreamResponse(body, overrides = {}) {
  return {
    status: 200,
    headers: { get: () => "application/json; charset=utf-8" },
    text: async () => JSON.stringify(body),
    ...overrides
  };
}

test("stadtteile proxy forwards a successful Supabase response", async () => {
  let request;
  const handler = createHandler({
    env: ENV,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return upstreamResponse([{ nummer: "01", name: "Stadtkern" }]);
    }
  });

  const result = await handler({ queryStringParameters: { type: "stadtteile" } });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(JSON.parse(result.body), [{ nummer: "01", name: "Stadtkern" }]);
  assert.equal(
    request.url,
    "https://example.supabase.co/rest/v1/stadtteilgrenzen_geojson?select=*"
  );
  assert.equal(request.options.headers.apikey, ENV.SUPABASE_KEY);
  assert.equal(request.options.headers.Authorization, `Bearer ${ENV.SUPABASE_KEY}`);
  assert.equal(result.headers["Access-Control-Allow-Origin"], "*");
});

test("stadtteile proxy rejects missing Supabase configuration", async () => {
  let called = false;
  const handler = createHandler({
    env: {},
    fetchImpl: async () => {
      called = true;
      return upstreamResponse([]);
    }
  });

  const result = await handler({ queryStringParameters: { type: "stadtteile" } });

  assert.equal(result.statusCode, 500);
  assert.match(JSON.parse(result.body).error, /configuration is missing/i);
  assert.equal(called, false);
});

test("stadtteile proxy converts network errors to 502", async () => {
  const handler = createHandler({
    env: ENV,
    fetchImpl: async () => {
      throw new Error("connection reset");
    }
  });

  const result = await handler({ queryStringParameters: { type: "stadtteile" } });

  assert.equal(result.statusCode, 502);
  assert.match(JSON.parse(result.body).error, /request failed/i);
});

test("stadtteile proxy preserves an upstream non-2xx status and body", async () => {
  const handler = createHandler({
    env: ENV,
    fetchImpl: async () => upstreamResponse(
      { code: "PGRST301", message: "permission denied" },
      { status: 403 }
    )
  });

  const result = await handler({ queryStringParameters: { type: "stadtteile" } });

  assert.equal(result.statusCode, 403);
  assert.deepEqual(JSON.parse(result.body), {
    code: "PGRST301",
    message: "permission denied"
  });
});
