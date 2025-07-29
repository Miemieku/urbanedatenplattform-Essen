// netlify/functions/supabaseProxy.js
export async function handler(event, context) {
  const API_KEY = process.env.SUPABASE_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;

  // 解析参数
  const params = event.queryStringParameters;
  const stationId = params.stationId;

  // 查询 Supabase
  const url = `${SUPABASE_URL}/rest/v1/luftqualitaet_24h?station_id=eq.${stationId}&order=timestamp.asc`;
  const response = await fetch(url, {
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
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type"
    },
    body: JSON.stringify(data)
  };
}