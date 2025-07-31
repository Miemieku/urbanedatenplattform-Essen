const API_BASE_URL = "https://datenplattform-essen.netlify.app/.netlify/functions/ubaProxy?";
let stationCoords = {}; // 存储Düsseldorf测量站点
let components = {}; // 存储污染物 ID → 名称
let mapMarkers = {};

// 获取污染物 ID → 名称
fetch("./components.json") // 确保路径正确
    .then(response => response.json())
    .then(data => {
        console.log("Komponenten JSON Datei geladen:", data);

        if (!data || !data[1]) {
            console.warn("⚠️ Keine gültigen Schadstoffdaten gefunden!");
            return;
        }

        // 遍历 JSON 数据，将污染物 ID 映射到名称和单位
        Object.values(data).forEach(entry => {
            const pollutantId = entry[0]; // 例如 "1"
            const pollutantCode = entry[1]; // 例如 "PM2"
            const pollutantSymbol = entry[2]
            const pollutantUnit = entry[3]; // 例如 "µg/m³"

            components[pollutantId] = { code: pollutantCode, symbol: pollutantSymbol, unit: pollutantUnit };
        });

        console.log("Schadstoff-Komponenten gespeichert:", components);
    })
    .catch(error => {
        console.error("❌Fehler beim Laden der Schadstoff-Komponenten:", error);
    });

// 获取Düsseldorf测量站坐标
function fetchStationCoordinates() {
    const apiUrl = `${API_BASE_URL}api=stationCoordinates`;

    return fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Netzwerkantwort war nicht ok');
            }
            return response.json();
        })
        .then(data => {
            if (!data || !data.data) {
                throw new Error('Ungültige Datenstruktur');
            }

            console.log("📌Alle Messstationen Daten:", data);

            // 🚀 **确保 `data.data` 是数组**
            let stations = Array.isArray(data.data) ? data.data : Object.values(data.data);

            // 过滤出 Düsseldorf
            let filteredStations = stations.filter(entry => 
                entry[3] === "Düsseldorf" && entry[6] === null
            );
            
            // 先检查是否有匹配的 Düsseldorf 站点
            console.log("📌过滤后的 Düsseldorf 站点:", filteredStations);
            // `3` 是城市名称字段

            if (filteredStations.length === 0) {
                console.warn("⚠️Keine Messstationen für Düsseldorf gefunden!");
                return;
            }

            filteredStations.forEach(entry => {
                let stationId = entry[1];  // Code，例如 "DENW134"
                let stationName = entry[2];  // 名称，例如 "Essen-Steele"
                let city = entry[3];        // 城市名 "Essen"
                let lat = parseFloat(entry[8]); // 纬度
                let lon = parseFloat(entry[7]); // 经度

                stationCoords[stationId] = { city, stationName, lat, lon };
            });

            console.log("Stationen in Düsseldorf gespeichert:", stationCoords);
        })
        .catch(error => {
            console.error('Fehler beim Abrufen der Messstationen:', error);
        });
}

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

// 获取空气质量数据
function fetchAirQualityData(stationId) {
    const { date, hour } = getCurrentTime();
    const startHour = Math.max(0, hour-4)
    const apiUrl = `${API_BASE_URL}api=airQuality&date_from=${date}&date_to=${date}&time_from=${hour}&time_to=${hour}&station=${stationId}`;

    return fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
        console.log(`API Antwort für ${stationId}:`, data);

        if (!data || !data.data) {
            return null;
        }

    const actualStationId = data.request?.station;
              const records = Object.values(data.data)[0];
              const timestamps = Object.keys(records);

              if (timestamps.length === 0) {
                  return null;
              }
        // get latest available timestamp
    const latestTimestamp = timestamps[timestamps.length - 1];

    // derive enddate and endtime from latest timestamp
    const latestDateObj = new Date(latestTimestamp);
    const dateto = latestDateObj.toISOString().split("T")[0];
    const timeto = latestDateObj.getHours();

        return { 
          stationId: actualStationId, 
          data: data.data[0],
          endtime: timeto, 
          enddate: dateto };
    })
        .catch(error => {
            console.error(`Fehler beim Laden der Luftqualität für ${stationId}:`, error);
            return null;
        });
}

// 获取数据库中的最新空气质量数据
function fetchLatestAirQualityData() {
    const dbUrl = `/.netlify/functions/supabaseProxy?type=latest_luftqualitaet`;
    
    return fetch(dbUrl)
    .then(response => response.json())
    .then(data => {
        console.log(" 数据库最新数据:", data);
        
        if (!data || !Array.isArray(data) || data.length === 0) {
            console.warn("⚠️ 数据库中没有找到最新数据");
            return null;
        }
        
        return data;
    })
    .catch(error => {
        console.error("❌ 获取数据库最新数据失败:", error);
        return null;
    });
}

// 返回污染物值的等级（1=Sehr gut, 5=Sehr schlecht）
function getPollutantLevel(code, value) {
    if (value === null || value === undefined) return 1;

    switch (code) {
        case "NO2":
            if (value > 200) return 5;
            else if (value > 100) return 4;
            else if (value > 40) return 3;
            else if (value > 20) return 2;
            else return 1;

        case "PM10":
            if (value > 100) return 5;
            else if (value > 50) return 4;
            else if (value > 35) return 3;
            else if (value > 20) return 2;
            else return 1;

        case "PM2":  
            if (value > 50) return 5;
            else if (value > 25) return 4;
            else if (value > 20) return 3;
            else if (value > 10) return 2;
            else return 1;

        case "O3":
            if (value > 240) return 5;
            else if (value > 180) return 4;
            else if (value > 120) return 3;
            else if (value > 60) return 2;
            else return 1;

        default:
            return 1; // 默认很好
    }
}


//  获得最差等级
function getWorstIndexLevel(NO2, PM10, PM2, O3) {
  let level = 1; // 默认最优（sehr gut）

  if (NO2 > 200 || PM10> 100 || PM2 > 50 || O3 > 240) level = 5;
  else if (NO2 > 100 || PM10 > 50 || PM2 > 25 || O3 > 180) level = 4;
  else if (NO2 > 40 || PM10 > 35 || PM2 > 20 || O3 > 120) level = 3;
  else if (NO2 > 20 || PM10 > 20 || PM2 > 10 || O3 > 60) level = 2;

  return level;
}

//  获得颜色
function getWorstIndexColor(NO2, PM10, PM2, O3) {
  const level = getWorstIndexLevel(NO2, PM10, PM2, O3);
  
  const colorMap = {
    1: '#00cccc', // sehr gut
    2: '#00cc99', // gut
    3: '#ffff66', // mäßig
    4: '#cc6666', // schlecht
    5: '#990033'  // sehr schlecht
  };

  return colorMap[level];
}

//  在地图上添加测量站点 - 使用数据库最新数据
function addStationsToMap() {
    console.log("🔄 正在从数据库加载最新空气质量数据...");
    
    fetchLatestAirQualityData().then(latestData => {
        if (!latestData) {
            console.error("❌ 无法获取数据库最新数据");
            return;
        }
        
        console.log(`✅ 成功获取 ${latestData.length} 个站点的最新数据`);
        
        // 为每个有坐标的站点添加标记
        Object.keys(stationCoords).forEach(stationId => {
            // 找到对应站点的最新数据
            const stationData = latestData.find(data => data.station_id === stationId);
            
            if (!stationData) {
                console.warn(`⚠️ 站点 ${stationId} 没有找到最新数据`);
                return;
            }
            
            // 直接从数据库数据中提取污染物值
            const NO2 = stationData.no2 || 0;
            const PM10 = stationData.pm10 || 0;
            const PM2 = stationData.pm2 || 0;
            const O3 = stationData.o3 || 0;
            
            const color = getWorstIndexColor(NO2, PM10, PM2, O3);
            const latLng = [stationCoords[stationId].lat, stationCoords[stationId].lon];
            const level = getWorstIndexLevel(NO2, PM10, PM2, O3);
            
            const qualityTextMap = {
                1: "Sehr gut",
                2: "Gut", 
                3: "Mäßig",
                4: "Schlecht",
                5: "Sehr schlecht"
            };
            const qualityLabel = qualityTextMap[level];
            
            console.log(` 站点 ${stationId} 数据:`, {NO2, PM10, PM2, O3, level, color});

            // 使用 Leaflet CircleMarker
            const circle = L.circleMarker(latLng, {
                radius: 10,
                fillColor: color,
                fillOpacity: 0.8,
                color: "#333",
                weight: 1
            });

            // Tooltip（站点名）
            circle.bindTooltip(stationCoords[stationId].stationName || stationId, {
                permanent: false,
                sticky: true
            });

            // 构造与原格式兼容的污染物数据，用于详情面板
            const pollutantData = [];
            if (stationData.no2 !== null) pollutantData.push(["1", stationData.no2]);
            if (stationData.pm10 !== null) pollutantData.push(["2", stationData.pm10]);
            if (stationData.o3 !== null) pollutantData.push(["3", stationData.o3]);
            if (stationData.pm2 !== null) pollutantData.push(["4", stationData.pm2]);

            const dateObj = new Date(stationData.timestamp);
            const enddate = dateObj.toISOString().split("T")[0];
            const endtime = dateObj.getHours();

            // 点击显示右侧信息栏
            circle.on("click", () => {
                showDataInPanel(
                    stationCoords[stationId].stationName,
                    stationData.timestamp,
                    pollutantData,
                    stationId,
                    enddate,
                    endtime
                );
            });

            circle.addTo(map);
            mapMarkers[stationId] = circle;
        });
    });
}


function showDataInPanel(stationName, timestamp, pollutantData, stationId, enddate, endtime) {
  const wrapper = document.getElementById("info-panel");
  const content = document.getElementById("air-quality-panel");

  if (!wrapper || !content) return;

  // 处理时间 - 支持数据库的ISO时间格式
  let end;
  if (timestamp && timestamp.includes('T')) {
    // 数据库中的ISO时间格式
    end = new Date(timestamp);
  } else {
    // 原来的格式（enddate + endtime）
    const dateString = `${enddate} ${endtime}`;
    end = new Date(dateString);
  }

  // 验证时间是否有效
  if (isNaN(end.getTime())) {
    console.error("❌ 无效的时间格式:", { timestamp, enddate, endtime });
    end = new Date(); // 使用当前时间作为后备
  }

  const formatTime = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`;

  function formatTimeDE(date) {
    return date.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).replace(",", "");
  }

  // 生成污染物值映射
  const values = {};
  pollutantData.forEach(([id, value]) => {
    const info = components[id];
    if (info) {
      values[info.code] = {
        value,
        unit: info.unit,
        symbol: info.symbol,
        level: getPollutantLevel(info.code, value)
      };
    }
  });

  // 从值中提取目标污染物（默认为 0）
  const NO2 = values["NO2"]?.value || 0;
  const PM10 = values["PM10"]?.value || 0;
  const PM2 = values["PM2"]?.value || 0;
  const O3 = values["O3"]?.value || 0;

  // 计算 Luftqualität 总体等级
  const overallLevel = getWorstIndexLevel(NO2, PM10, PM2, O3);

  const qualityTextMap = {
    1: "Sehr gut",
    2: "Gut",
    3: "Mäßig",
    4: "Schlecht",
    5: "Sehr schlecht"
  };
  const qualityLabel = qualityTextMap[overallLevel];

  // 颜色表
  const colorMap = {
    1: "#00cccc",
    2: "#00cc99",
    3: "#ffff66",
    4: "#cc6666",
    5: "#990033"
  };

  // 健康提示
  const healthHints = {
    1: "Beste Voraussetzungen, um sich ausgiebig im Freien aufzuhalten.",
    2: "Genießen Sie Ihre Aktivitäten im Freien, gesundheitlich nachteilige Wirkungen sind nicht zu erwarten.",
    3: "Kurzfristige nachteilige Auswirkungen auf die Gesundheit sind unwahrscheinlich. Allerdings können Effekte durch Luftschadstoffkombinationen und bei langfristiger Einwirkung des Einzelstoffes nicht ausgeschlossen werden. Zusätzliche Reize, z.B. ausgelöst durch Pollenflug, können die Wirkung der Luftschadstoffe verstärken, so dass Effekte bei empfindlichen Personengruppen (z.B. Asthmatikern) wahrscheinlicher werden.",
    4: "Bei empfindlichen Menschen können nachteilige gesundheitliche Wirkungen auftreten. Diese sollten körperlich anstrengende Tätigkeiten im Freien vermeiden. In Kombination mit weiteren Luftschadstoffen können auch weniger empfindliche Menschen auf die Luftbelastung reagieren.",
    5: "Negative gesundheitliche Auswirkungen können auftreten. Wer empfindlich ist oder vorgeschädigte Atemwege hat, sollte körperliche Anstrengungen im Freien vermeiden."
  };
  const healthText = healthHints[overallLevel];

  // 构建 HTML
  const messzeitHtml = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
      <div>
        <b style="color: #34495e;">Messzeit:</b>
        ${formatTimeDE(end)}
      </div>
      <button class="btn-history" id="btn-history" style="margin-left: 10px;">Vergangene 24 Stunden</button>
    </div>
  `;

  let html = `
    <h3 style="color: #2c3e50; margin-bottom: 15px;">${stationName}</h3>
    <p style="margin-bottom: 10px;"><strong style="color: #34495e;">Luftqualität:</strong> 
      <span style="font-size: 1.5em; font-weight: bold; color: ${
        colorMap[overallLevel]
      };">${qualityLabel}</span>
    </p>
    ${messzeitHtml}
    <hr style="border-color: #ecf0f1;">
    <h4 style="color: #2c3e50; margin: 20px 0 15px 0;">Schadstoffkonzentrationen</h4>
    <ul style="list-style:none; padding:0;">`;

  ["NO2", "PM10", "O3", "PM2"].forEach((code) => {
    if (values[code]) {
      const { value, unit, symbol, level } = values[code];
      const dot = `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${colorMap[level]};margin-right:6px;"></span>`;
      html += `<li style="margin-bottom: 8px; color: #34495e; font-size: 14px;">${dot} <strong style="color: #2c3e50;">${symbol}:</strong> ${
        value !== null ? value : "-"
      } <span style="color: #7f8c8d; font-size: 12px;">${unit}</span></li>`;
    }
  });

  html += `</ul>
  <h4 style="color: #2c3e50; margin: 20px 0 15px 0;">Gesundheitshinweise und Empfehlungen:</h4>
  <p style="font-size:0.95em; color:#34495e; line-height: 1.5; margin-bottom: 20px;">${healthText}</p>
    <hr style="border-color: #ecf0f1;">
    <h4 style="color: #2c3e50; margin: 20px 0 15px 0;">Index-Farblegende</h4>
    <div style="margin-bottom: 20px;">
      <span style="display:inline-block;width:15px;height:15px;background:#00cccc;margin-right:5px;"></span><span style="color: #34495e;">Sehr gut</span>
      <span style="display:inline-block;width:15px;height:15px;background:#00cc99;margin:0 10px;"></span><span style="color: #34495e;">Gut</span>
      <span style="display:inline-block;width:15px;height:15px;background:#ffff66;margin:0 10px;"></span><span style="color: #34495e;">Mäßig</span>
      <span style="display:inline-block;width:15px;height:15px;background:#cc6666;margin:0 10px;"></span><span style="color: #34495e;">Schlecht</span>
      <span style="display:inline-block;width:15px;height:15px;background:#990033;margin:0 10px;"></span><span style="color: #34495e;">Sehr schlecht</span>
    </div>
    <p style="margin-top:15px;font-size:0.85em; color: #7f8c8d;">
      <strong style="color: #34495e;">Quelle:</strong> Umweltbundesamt<br>
      <strong style="color: #34495e;">Weiter Informationen:</strong> <a href="https://www.umweltbundesamt.de/berechnungsgrundlagen-luftqualitaetsindex" target="_blank" style="color: #3498db; text-decoration: none;">
      Umweltbundesamt – Berechnungsgrundlagen Luftqualitätsindex</a>
    </p>
  `;

  content.innerHTML = html;
  wrapper.classList.add("visible");

  // 绑定按钮事件
  const btnHistory = document.getElementById("btn-history");
  if (btnHistory) {
    btnHistory.onclick = function() {
      document.getElementById("history-modal").classList.add("active");
      // 这里调用曲线渲染函数
      loadAndRenderHistoryChart(stationId); // 你需要把当前站点ID传进来
    };
  }
}

async function loadAndRenderHistoryChart(stationId) {
  const url = `/.netlify/functions/supabaseProxy?type=luftqualitaet&stationId=${stationId}`;
  console.log("加载并渲染历史图表，站点ID:", stationId);
  const res = await fetch(url);
  const data = await res.json();
  console.log("获取到的数据:", data);
  if (!data || data.length === 0) {
    alert("Keine Daten in den letzten 24 Stunden verfügbar.");
    return;
  }

  const labels = data.map(row => new Date(row.timestamp).toLocaleTimeString("de-DE", {hour:"2-digit",minute:"2-digit"}));
  const pm10 = data.map(row => row.pm10);
  const no2 = data.map(row => row.no2);
  const pm2 = data.map(row => row.pm2);
  const o3 = data.map(row => row.o3);

  renderLineChart("chart-pm10", labels, pm10, "Feinstaub PM10", "#00e6e6");
  renderLineChart("chart-no2", labels, no2, "Stickstoffdioxid (NO₂)", "#00bfff");
  renderLineChart("chart-pm2", labels, pm2, "Feinstaub PM2,5", "#00ff99");
  renderLineChart("chart-o3", labels, o3, "Ozon (O₃)", "#00ffcc");
}

function renderLineChart(canvasId, labels, data, label, color) {
  const ctx = document.getElementById(canvasId).getContext("2d");

  if (window[canvasId + "_chart"]) {
    window[canvasId + "_chart"].destroy();
  }

  window[canvasId + "_chart"] = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: label,
        data: data,
        borderColor: color,
        backgroundColor: color + "33",
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false},
        title: {
          display: true,
          text:label,
          color: "2c3e50",
          font: {
            size:14,
            weight:"bold"
          },
          padding: {bottom:10}
        }
      },

      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 6 }
        },
        y: {
          grid: { display: false },
          ticks: {maxTicksLimit: 4 }
        }
      }
    }
  });
}



// 6️⃣ 监听 `Luftqualität` 复选框
document.addEventListener("DOMContentLoaded", function () {
    fetchStationCoordinates().then(() => {
        document.getElementById("air-quality").addEventListener("change", function () {
            if (this.checked) {
                addStationsToMap();
            } else {
                Object.keys(mapMarkers).forEach(stationId => map.removeLayer(mapMarkers[stationId]));
                mapMarkers = {};
            }
        });
    });
});

// 关闭按钮事件建议只绑定一次（在 DOMContentLoaded 里）：
document.addEventListener("DOMContentLoaded", function () {
  const closeModal = document.getElementById("close-modal");
  if (closeModal) {
    closeModal.onclick = function() {
      document.getElementById("history-modal").classList.remove("active");
    };
  }
});