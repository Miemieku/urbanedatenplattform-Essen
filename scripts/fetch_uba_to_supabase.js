// 📦 依赖
const fetch = require("node-fetch");
const fs = require("fs");

// 🔐 环境变量（在 GitHub Actions 中注入）
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const API_BASE_URL = "https://datenplattform-essen.netlify.app/.netlify/functions/ubaProxy?";
const STATION_API = "https://www.umweltbundesamt.de/api/air_data/v3/stations/json?use=airquality&lang=de";

// 获取当前时间
function getCurrentTime() {
    const now = new Date();
    const date = now.toISOString().split("T")[0]; // YYYY-MM-DD
    let hour = now.getHours() - 2; // 🚀 取上2个小时的数据

    if (hour < 0) {
        hour = 23; // 取前一天的 23:00 数据
        date = new Date(now.setDate(now.getDate() - 1)).toISOString().split("T")[0]; // 取前一天的日期
    }
    return { date, hour };
}

// 🧠 加载 components 映射（与前端一致）
const components = {};
const compData = JSON.parse(fs.readFileSync("./public/components.json", "utf8"));
Object.values(compData).forEach(entry => {
  const pollutantId = entry[0];
  const pollutantCode = entry[1];
  const pollutantSymbol = entry[2];
  const pollutantUnit = entry[3];
  components[pollutantId] = { code: pollutantCode, symbol: pollutantSymbol, unit: pollutantUnit };
});

// 📍 获取 Düsseldorf 的测站
async function getDusseldorfStations() {
  const res = await fetch(STATION_API);
  const json = await res.json();

  let stations = [];
  if (Array.isArray(json.data)) {
    stations = json.data;
  } else if (json.data && typeof json.data === "object") {
    stations = Object.values(json.data);
  }

  return stations
    .filter(st => st[3] === "Düsseldorf")
    .map(st => ({
      id: st[1],
      name: st[2],
      city: st[3],
      lat: parseFloat(st[8]),
      lon: parseFloat(st[7])
    }));
}

// 🌫 获取某测站的空气质量数据
async function fetchAirQuality(stationId) {
  const { date, hour } = getCurrentTime();

  const apiUrl = `${API_BASE_URL}api=airQuality&date_from=${date}&date_to=${date}&time_from=${hour}&time_to=${hour}&station=${stationId}`;
  const response = await fetch(apiUrl);
  const data = await response.json();

  if (!data || !data.data) return null;
  console.log("完整的 API 数据:", JSON.stringify(data, null, 2));

  const entry = Object.values(data.data)[0];
  const timestamps = Object.keys(entry).sort((a, b) => new Date(a) - new Date(b));
  const latestKey = timestamps[timestamps.length - 1];
  const actualTimestamp = entry[latestKey][0];
  const pollutantData = entry[latestKey].slice(3);

  const pollutants = {};
  pollutantData.forEach(([id, val]) => {
    const pollutantInfo = components[id];
    if (!pollutantInfo) return;
  console.log(`ID: ${id}, Pollutant Info:`, pollutantInfo);
    if (pollutantInfo.code === "NO2") pollutants.no2 = val;
    if (pollutantInfo.code === "PM10") pollutants.pm10 = val;
    if (pollutantInfo.code === "PM2") pollutants.pm2 = val;
    if (pollutantInfo.code === "O3") pollutants.o3 = val;
  });

  return { timestamp: actualTimestamp, ...pollutants };
}

// ⬇ 写入 Supabase
async function insertIntoSupabase(station, data) {
  if (!data) return;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/luftqualitaet`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({
      station_id: station.id,
      station_name: station.name,
      timestamp: data.timestamp,
      no2: data.no2 ?? null,
      pm10: data.pm10 ?? null,
      pm2: data.pm2 ?? null,
      o3: data.o3 ?? null,
      created_at: new Date().toISOString()
    })
  });

  if (!res.ok) {
    console.error(`❌ Fehler bei Insert (${station.id}):`, await res.text());
  } else {
    console.log(`✅ Erfolgreich gespeichert: ${station.name} (${station.id})`);
  }
}

// 🚀 主流程
async function main() {
  const stations = await getDusseldorfStations();
  console.log(`📍 ${stations.length} Stationen in Düsseldorf gefunden`);

  for (const st of stations) {
    try {
      const data = await fetchAirQuality(st.id);
      await insertIntoSupabase(st, data);
    } catch (err) {
      console.error(`⚠️ Fehler bei Station ${st.id}:`, err);
    }
  }
}

main();