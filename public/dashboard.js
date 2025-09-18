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


// Wetter API 调用
fetch("https://api.open-meteo.com/v1/forecast?latitude=51.45&longitude=7.01&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,uv_index,cloud_cover")
  .then(r => r.json())
  .then(data => {
    const weather = data.current;

    document.getElementById('apparent-temp').textContent = `${weather.apparent_temperature}°C`;
    document.getElementById('humidity').textContent = `${weather.relative_humidity_2m}%`;
    document.getElementById('wind').textContent = `${weather.wind_speed_10m} m/s`;
    document.getElementById('wind-dir').style.transform = `rotate(${weather.wind_direction_10m}deg)`;
    document.getElementById('rain').textContent = `${weather.precipitation} mm`;
    document.getElementById('uv').textContent = weather.uv_index;
    document.getElementById('cloud').textContent = `${weather.cloud_cover}%`;
  })
  .catch(err => console.error("Wetter API Fehler:", err));

// === Station Auswahl & Luftqualität Card ===

// 加载所有 Station 到下拉框
document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("station-select");

  // ⚠️ 依赖 map.js 里的 fetchStationCoordinates / stationCoords
  fetchStationCoordinates().then(() => {
    Object.entries(stationCoords).forEach(([id, info]) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = info.stationName;
      select.appendChild(opt);
    });
  });

  // 当选择一个 Station 时，加载最新空气质量
  select.addEventListener("change", async function () {
    const stationId = this.value;
    const latestData = await fetchLatestAirQualityData();
    if (!latestData) return;

    const stationData = latestData.find((d) => d.station_id === stationId);
    const qualityEl = document.getElementById("station-quality");

    if (!stationData) {
      qualityEl.textContent = "Keine Daten verfügbar.";
      return;
    }

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

    qualityEl.innerHTML = `
      <span style="color:${colorMap[level]}; font-weight:bold;">
        ${qualityTextMap[level]}
      </span>
    `;
  });

  // 打开 map.html 并传递 stationId
  document.getElementById("open-map-btn").addEventListener("click", () => {
    const stationId = select.value;
    if (stationId) {
      window.location.href = `map.html?station=${stationId}`;
    }
  });
});
