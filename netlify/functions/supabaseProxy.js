// netlify/functions/supabaseProxy.js

export async function handler(event, context) {
    const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqbXp6c216dmF3bnh5dXhhamJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0OTY0NjcsImV4cCI6MjA2ODA3MjQ2N30.VHPh9C2NEQIpOT5xy8mP7wfJyhDXUEZaf2IiDI1c3L4"
    const SUPABASE_URL = "https://qjmzzsmzvawnxyuxajbg.supabase.co"
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
