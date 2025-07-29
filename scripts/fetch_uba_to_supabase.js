// 📦 依赖
const fetch = require("node-fetch");
const fs = require("fs");

// 🔐 环境变量（在 GitHub Actions 中注入）
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const STATION_API = "https://www.umweltbundesamt.de/api/air_data/v2/stations/json?use=airquality&lang=de";
const AIR_API = "https://www.umweltbundesamt.de/api/air_data/v2/airquality/json";

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

// 获取当前查询时间（和前端 airQuality.js 保持一致）
function getCurrentTime() {
  const now = new Date();
  let date = now.toISOString().split("T")[0];
  let hour = now.getHours() - 2; // 🚀 比当前时间早2小时

  if (hour < 0) {
    hour = 23;
    date = new Date(now.setDate(now.getDate() - 1)).toISOString().split("T")[0];
  }
  return { date, hour };
}

// 获取单个站点的最新数据
async function fetchAirQuality(stationId) {
  const { date, hour } = getCurrentTime();
  const apiUrl = `${AIR_API}?date_from=${date}&date_to=${date}&time_from=${hour}&time_to=${hour}&station=${stationId}`;
  console.log(`📡 Fetching data for station ${stationId}: ${apiUrl}`);

  const response = await fetch(apiUrl);
  const data = await response.json();

  if (!data || !data.data) return null;

  const entry = Object.values(data.data)[0];
  const latestKey = Object.keys(entry).pop();

  console.log (`📊 Latest data for ${stationId}:`, latestKey);
  const latestValues = entry[latestKey].slice(3);

  const pollutants = {};
  latestValues.forEach(([id, val]) => {
    if (id == 5) pollutants.no2 = val;
    if (id == 1) pollutants.pm10 = val;
    if (id == 9) pollutants.pm20 = val;
    if (id == 3) pollutants.o3 = val;
  });

  // ✅ timestamp 用 API 的时间 +1 小时（测量结束时间）
  const startTime = new Date(latestKey);
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

  return { timestamp: endTime.toISOString(), ...pollutants };
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
      pm20: data.pm20 ?? null,
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