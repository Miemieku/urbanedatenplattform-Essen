// netlify/functions/supabaseProxy.js
function createHandler({ fetchImpl = globalThis.fetch, env = process.env } = {}) {
  return async function handler(event, context) {
    const API_KEY = env.SUPABASE_KEY;
    const SUPABASE_URL = env.SUPABASE_URL;

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

    if (!SUPABASE_URL || !API_KEY) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Supabase configuration is missing" })
      };
    }

    let response;
    try {
      response = await fetchImpl(url, {
        headers: {
          apikey: API_KEY,
          Authorization: `Bearer ${API_KEY}`,
          Accept: "application/json"
        }
      });
    } catch (error) {
      console.error("Supabase request failed:", error?.message || error);
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Supabase request failed" })
      };
    }

    const body = await response.text();

    return {
      statusCode: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": response.headers.get("content-type") || "application/json"
      },
      body
    };
  };
}

const handler = createHandler();

module.exports = { createHandler, handler };
