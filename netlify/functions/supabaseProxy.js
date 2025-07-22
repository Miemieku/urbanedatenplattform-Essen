// netlify/functions/supabaseProxy.js

export async function handler(event, context) {
  const response = await fetch("https://qmjzzsmzvawnxyuxajbg.supabase.co/rest/v1/stadtteilgrenzen_geojson?select=*", {
    headers: {
      apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqbXp6c216dmF3bnh5dXhhamJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0OTY0NjcsImV4cCI6MjA2ODA3MjQ2N30.VHPh9C2NEQIpOT5xy8mP7wfJyhDXUEZaf2IiDI1c3L4",
      Authorization: `Bearer ${API_KEY}`
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
