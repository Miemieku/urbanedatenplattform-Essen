const fetch = require("node-fetch");

const NEXTBIKE_URL = "https://api.nextbike.net/maps/nextbike-live.json?city=133";
const ESSEN_CITY_ID = 133;

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    },
    body: JSON.stringify(body)
  };
}

function createHandler(fetchImpl = fetch) {
  return async function handler(event = {}) {
    if (event.httpMethod === "OPTIONS") {
      return jsonResponse(204, {});
    }

    if (event.httpMethod && event.httpMethod !== "GET") {
      return jsonResponse(405, { error: "Method not allowed" });
    }

    try {
      const response = await fetchImpl(NEXTBIKE_URL, { timeout: 10000 });

      if (!response.ok) {
        throw new Error(`Nextbike returned ${response.status} ${response.statusText}`.trim());
      }

      const data = await response.json();
      const countries = Array.isArray(data?.countries) ? data.countries : [];
      const cities = countries.flatMap(country =>
        Array.isArray(country?.cities) ? country.cities : []
      );
      const city = cities.find(candidate => candidate?.uid === ESSEN_CITY_ID);

      if (!city) {
        throw new Error(`Essen city ${ESSEN_CITY_ID} is missing from the Nextbike response`);
      }

      if (!Number.isFinite(city.available_bikes) || !Number.isFinite(city.set_point_bikes)) {
        throw new Error("Nextbike response contains invalid city KPI values");
      }

      const places = (Array.isArray(city.places) ? city.places : [])
        .filter(place => place && typeof place.name === "string")
        .map(place => ({
          name: place.name,
          bikes: Number.isFinite(place.bikes) ? place.bikes : 0,
          free_racks: Number.isFinite(place.free_racks) ? place.free_racks : 0
        }));

      if (places.length === 0) {
        throw new Error("Nextbike response contains no usable Essen stations");
      }

      return jsonResponse(200, {
        available_bikes: city.available_bikes,
        set_point_bikes: city.set_point_bikes,
        places
      });
    } catch (error) {
      console.error("Nextbike proxy failed:", error.message);
      return jsonResponse(502, {
        error: "Nextbike data is currently unavailable",
        details: error.message
      });
    }
  };
}

exports.createHandler = createHandler;
exports.handler = createHandler();
