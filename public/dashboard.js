document.addEventListener("DOMContentLoaded", async () => {
  const lat = 51.45; // Essen
  const lon = 7.01;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=apparent_temperature,relative_humidity_2m,precipitation,cloudcover,uv_index,windspeed_10m,winddirection_10m`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const current = data.current_weather;
    const hourly = data.hourly;

    // Gefühlt (apparent temperature)
    document.getElementById("apparent-temp").textContent =
      (hourly.apparent_temperature[0] ?? "--") + "°C";

    // Luftfeuchtigkeit
    document.getElementById("humidity").textContent =
      (hourly.relative_humidity_2m[0] ?? "--") + "%";

    // Wind
    document.getElementById("wind").textContent =
      (current.windspeed ?? "--") + " m/s";

    // Windrichtung
    const dir = current.winddirection ?? 0;
    const arrows = ["↑","↗","→","↘","↓","↙","←","↖"];
    const arrow = arrows[Math.round(dir/45) % 8];
    document.getElementById("wind-dir").textContent = arrow;

    // Niederschlag
    document.getElementById("rain").textContent =
      (hourly.precipitation[0] ?? "--") + " mm";

    // UV-Index
    document.getElementById("uv").textContent =
      hourly.uv_index[0] ?? "--";

    // Bewölkung
    document.getElementById("cloud").textContent =
      (hourly.cloudcover[0] ?? "--") + "%";

  } catch (err) {
    console.error("❌ Fehler beim Laden der Wetterdaten:", err);
    ["apparent-temp","humidity","wind","wind-dir","rain","uv","cloud"].forEach(id => {
      document.getElementById(id).textContent = "--";
    });
  }
});


// Nextbike API 调用
fetch("https://api.nextbike.net/maps/nextbike-live.json?city=133")
  .then(r => r.json())
  .then(data => {
    const city = data.countries[0].cities.find(c => c.uid === 133);

    // 顶部 KPI
    document.getElementById("nb-available").textContent = city.available_bikes;
    document.getElementById("nb-total").textContent = city.set_point_bikes;

    const places = city.places || [];

    // 空位最多 Top1
    const topFree = [...places].sort((a,b)=> (b.free_racks||0) - (a.free_racks||0))[0];
    const freeText = topFree ? `${topFree.name} (${topFree.free_racks||0})` : "n/a";
    const freeEl = document.getElementById("nb-top-free");
    freeEl.textContent = freeText;
    freeEl.title = freeText;

    // 车辆最少 Top1
    const topLow = [...places].sort((a,b)=> (a.bikes||0) - (b.bikes||0))[0];
    const lowText = topLow ? `${topLow.name} (${topLow.bikes||0})` : "n/a";
    const lowEl = document.getElementById("nb-top-low");
    lowEl.textContent = lowText;
    lowEl.title = lowText;
  })
  .catch(err => console.error("Nextbike API Fehler:", err));


document.addEventListener("DOMContentLoaded", async () => {
  const select = document.getElementById("station-select");
  const qualityEl = document.getElementById("station-quality");
  const detailsEl = document.getElementById("pollutant-details");
  const openMapBtn = document.getElementById("open-map-btn");

  // 默认站点 ID（Essen-Steele）
  const DEFAULT_STATION_ID = "DENW043";

  // 获取数据库数据 + Station 坐标
  const latestData = await fetchLatestAirQualityData();
  await fetchStationCoordinates();

  if (!latestData) return;

  // 下拉只显示有数据的站点
  latestData.forEach(d => {
    const info = stationCoords[d.station_id];
    if (info) {
      const opt = document.createElement("option");
      opt.value = d.station_id;
      opt.textContent = info.stationName;
      select.appendChild(opt);
    }
  });

  // 默认选 Steele
  if (stationCoords[DEFAULT_STATION_ID]) {
    select.value = DEFAULT_STATION_ID;
    loadAirQuality(DEFAULT_STATION_ID);
  } else if (select.options.length > 1) {
    select.selectedIndex = 1;
    loadAirQuality(select.value);
  }

  // 切换测站
  select.addEventListener("change", () => {
    if (select.value) {
      loadAirQuality(select.value);
    } else {
      qualityEl.textContent = "Bitte Station wählen...";
      detailsEl.innerHTML = "";
    }
  });

  // 按钮 → 跳转 map 页面
  openMapBtn.addEventListener("click", () => {
    const stationId = select.value;
    if (stationId) {
      window.location.href = `map.html?station=${stationId}`;
    }
  });

  // 加载空气质量数据
  function loadAirQuality(stationId) {
    const stationData = latestData.find(d => d.station_id === stationId);
    if (!stationData) return;

    const level = getWorstIndexLevel(
      stationData.no2,
      stationData.pm10,
      stationData.pm2,
      stationData.o3
    );

    const qualityTextMap = {
      1: "Sehr gut",
      2: "Gut",
      3: "Mäßig",
      4: "Schlecht",
      5: "Sehr schlecht",
    };
    const colorMap = {
      1: "#00cccc",
      2: "#00cc99",
      3: "#ffff66",
      4: "#cc6666",
      5: "#990033",
    };

    // 总体 Luftqualität
    qualityEl.innerHTML = `
      <span style="display:inline-block;width:12px;height:12px;
             border-radius:50%;background:${colorMap[level]};
             margin-right:6px;"></span>
      <span style="color:${colorMap[level]}; font-weight:bold;">
        ${qualityTextMap[level]}
      </span>
    `;

    // 污染物细节
    detailsEl.innerHTML = `
      <ul>
        <li>NO₂: ${stationData.no2 ?? "-"} µg/m³</li>
        <li>PM₁₀: ${stationData.pm10 ?? "-"} µg/m³</li>
        <li>PM₂.₅: ${stationData.pm2 ?? "-"} µg/m³</li>
        <li>O₃: ${stationData.o3 ?? "-"} µg/m³</li>
      </ul>
    `;
  }
});
