// netlify/functions/supabaseProxy.js
export async function handler(event, context) {
  const API_KEY = process.env.SUPABASE_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;

  // 解析参数
  const params = event.queryStringParameters || {};
  const type = params.type || "stadtteile"; // 默认查询 Stadtteile
  const stationId = params.stationId;

  let url;

  if (type === "luftqualitaet") {
    if (!stationId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "stationId 参数缺失" })
      };
    }
    url = `${SUPABASE_URL}/rest/v1/luftqualitaet_24h?station_id=eq.${stationId}&order=timestamp.asc`;
  } else if (type === "latest_luftqualitaet") {
    // 获取最新数据 - 使用你创建的视图
    if (stationId) {
      // 获取特定站点的最新数据
      url = `${SUPABASE_URL}/rest/v1/latest_luftqualitaet?station_id=eq.${stationId}`;
    } else {
      // 获取所有站点的最新数据
      url = `${SUPABASE_URL}/rest/v1/latest_luftqualitaet?select=*`;
    }
  } else if (type === "stadtteile") {
    url = `${SUPABASE_URL}/rest/v1/stadtteilgrenzen_geojson?select=*`;
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "未知 type 参数" })
    };
  }

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