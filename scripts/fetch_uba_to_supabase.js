const fetch = require("node-fetch");
 
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
 
const STATION_API = "https://www.umweltbundesamt.de/api/air_data/v2/stations/json?use=airquality&lang=de";
const AIR_API = "https://www.umweltbundesamt.de/api/air_data/v2/airquality/json";
 
// 获取当前时间
function getCurrentTime() {
  const now = new Date();
  let date = now.toISOString().split("T")[0];
  let hour = now.getHours() - 2;
 
  if (hour < 0) {
    hour = 23;
    date = new Date(now.setDate(now.getDate() - 1)).toISOString().split("T")[0];
  }
 
  return { date, hour };
}

async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error(`Error fetching JSON data: ${error.message}`);
    return null;
  }
}
 
async function getDusseldorfStations() {
  const res = await fetch(STATION_API);
  const json = await res.json();
  const stations = json.data || [];
  
  return stations
    .filter(st => st[3] === "Düsseldorf") // 城市字段 = Düsseldorf
    .map(st => ({
      id: st[1],       // stationId
      name: st[2],     // stationName
      city: st[3],
      lat: st[8],
      lon: st[7]
    }));
}
 
async function fetchAirQuality(stationId) {
  const { date, hour } = getCurrentTime();
  const apiUrl = `${AIR_API}?date_from=${date}&date_to=${date}&time_from=${hour}&time_to=${hour}&station=${stationId}`;
  console.log(`📡 Fetching data for station ${stationId} ...`);
 
  const data = await fetchJSON(apiUrl);
  if (!data || !data.data) return null;
 
  const entry = Object.values(data.data)[0];
  const latestKey = Object.keys(entry).pop();
  const latestValues = entry[latestKey].slice(3);
 
  const pollutants = {};
  latestValues.forEach(([id, val]) => {
    if (id == 5) pollutants.no2 = val;
    if (id == 1) pollutants.pm10 = val;
    if (id == 9) pollutants.pm20 = val;
    if (id == 3) pollutants.o3 = val;
  });
 
  return { timestamp: latestKey, ...pollutants };
}

async function insertIntoSupabase(station, data) {
  if (!data) return;
 
  try {
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
        no2: data.no2,
        pm10: data.pm10,
        pm20: data.pm20,
        o3: data.o3
      })
    });
 
    if (!res.ok) {
      throw new Error(`Insert error: ${await res.text()}`);
    } else {
      console.log(`✅ Successfully saved: ${station.name} (${station.id})`);
    }
  } catch (error) {
    console.error(`❌ Error during Supabase insert (${station.id}): ${error.message}`);
  }
}
 
async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing environment variables for Supabase URL/Key.");
    return;
  }
 
  const stations = await getDusseldorfStations();
  console.log(`📍 Found ${stations.length} stations in Düsseldorf`);
 
  const dataFetchPromises = stations.map(async (station) => {
    const data = await fetchAirQuality(station.id);
    await insertIntoSupabase(station, data);
  });
 
  await Promise.all(dataFetchPromises);
}
 
main();