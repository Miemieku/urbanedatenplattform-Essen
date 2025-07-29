// netlify/functions/supabaseProxy.js

export async function handler(event, context) {
    const API_KEY = process.env.SUPABASE_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const response = await fetch(`${SUPABASE_URL}/rest/v1/stadtteilgrenzen_geojson?select=*`, {
        headers: {
            apikey: API_KEY,
            Authorization: `Bearer ${API_KEY}`,
            Accept: "application/json"
        }
    });

    const data = await response.json();

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*", // or restrict to Netlify domain
      "Access-Control-Allow-Headers": "Content-Type"
    },
    body: JSON.stringify(data)
  };
}
