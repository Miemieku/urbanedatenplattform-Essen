async function fetchWeather() {
  try {
    const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=51.45&longitude=7.01&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,uv_index,cloud_cover&daily=temperature_2m_min,temperature_2m_max&timezone=auto");
    const data = await response.json();
    console.log("Weather API result:", data);

    const weather = data.current;
    const minTemp = data.daily.temperature_2m_min[0];
    const maxTemp = data.daily.temperature_2m_max[0];

    document.getElementById('temp-now').textContent = `${weather.temperature_2m}°C`;
    document.getElementById('apparent-temp').textContent = `${weather.apparent_temperature}°C`;
    document.getElementById('humidity').textContent = `${weather.relative_humidity_2m}%`;
    document.getElementById('wind').textContent = `${weather.wind_speed_10m} m/s`;
    document.getElementById('wind-dir').style.transform = `rotate(${weather.wind_direction_10m}deg)`;
    document.getElementById('rain').textContent = `${weather.precipitation} mm`;
    document.getElementById('uv').textContent = weather.uv_index;
    document.getElementById('cloud').textContent = `${weather.cloud_cover}%`;

    // min/max 
    document.getElementById('temp-min').textContent = `${minTemp}°C`;
    document.getElementById('temp-max').textContent = `${maxTemp}°C`;

  } catch (err) {
    console.error("Weather API failed:", err);
  }
}

fetchWeather();



// Nextbike API 
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
    window.location.href = `map.html?show=airquality`;
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

    // 构建污染物细节 + 质量等级小块
    detailsEl.innerHTML = `
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
        <ul style="flex:1; margin:0; padding:0; list-style:none;">
          <li><strong>NO₂:</strong> ${stationData.no2 ?? "-"} µg/m³</li>
          <li><strong>PM₁₀:</strong> ${stationData.pm10 ?? "-"} µg/m³</li>
          <li><strong>PM₂.₅:</strong> ${stationData.pm2 ?? "-"} µg/m³</li>
          <li><strong>O₃:</strong> ${stationData.o3 ?? "-"} µg/m³</li>
        </ul>
        <div style="
          background:#fff;
          padding:6px 10px;
          border-radius:6px;
          font-weight:bold;
          color:${colorMap[level]};
          min-width:70px;
          text-align:center;
          ">
          ${qualityTextMap[level]}
        </div>
      </div>

    `;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const stationId = params.get("station");

  if (stationId) {
    const checkInterval = setInterval(() => {
      if (mapMarkers[stationId]) {
        mapMarkers[stationId].fire("click"); // 模拟点击 → 弹出信息面板
        clearInterval(checkInterval);
      }
    }, 500);
  }
});
