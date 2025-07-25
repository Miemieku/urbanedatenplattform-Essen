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
            const pollutantName = entry[1]; // 例如 "PM10"
            const pollutantUnit = entry[3]; // 例如 "µg/m³"

            components[pollutantId] = { name: pollutantName, unit: pollutantUnit };
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
    const apiUrl = `${API_BASE_URL}api=airQuality&date_from=${date}&date_to=${date}&time_from=${hour}&time_to=${hour}&station=${stationId}`;

    console.log(`📡 API Anfrage für ${stationId}: ${apiUrl}`);
    return fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
        console.log(`API Antwort für ${stationId}:`, data);

        if (!data || !data.data) {
            console.warn(`⚠️Keine Luftqualitätsdaten für ${stationId}`);
            return null;
        }

        const actualStationId = data.request?.station; // 确保 ID 正确
        console.log(`Station ID Mapping: ${stationId} → ${actualStationId}`);

        return { stationId: actualStationId, data: data.data[0] };
    })
        .catch(error => {
            console.error(`❌Fehler beim Laden der Luftqualität für ${stationId}:`, error);
            return null;
        });
}


//  获得颜色
function getWorstIndexColor(NO2, PM10, PM2, O3) {
  let level = 1; // 默认最优（sehr gut）

  if (NO2 > 200 || PM10 > 100 || PM2 > 50 || O3 > 240) level = 5;
  else if (NO2 > 100 || PM10 > 50 || PM2 > 25 || O3 > 180) level = 4;
  else if (NO2 > 40 || PM10 > 35 || PM2 > 20 || O3 > 120) level = 3;
  else if (NO2 > 20 || PM10 > 20 || PM2 > 10 || O3 > 60) level = 2;

  const colorMap = {
    1: '#00cccc', // sehr gut
    2: '#00cc99', // gut
    3: '#ffff66', // mäßig
    4: '#cc6666', // schlecht
    5: '#990033'  // sehr schlecht
  };

  return colorMap[level];
}

//  在地图上添加测量站点
function addStationsToMap() {
    Object.keys(stationCoords).forEach(stationId => {
        fetchAirQualityData(stationId).then(result => {
            if (!result || !result.data) {
                console.warn(`⚠️Keine Luftqualitätsdaten ${stationId}`);
                return;
            }

            let actualStationId = result.stationId;
            let timestamps = Object.keys(result.data);
            if (timestamps.length === 0) {
                console.warn(`⚠️Keine Messwerte für ${actualStationId}`);
                return;
            }

            let latestTimestamp = timestamps[timestamps.length - 1];
            let actualTimestamp = result.data[latestTimestamp][0];
            let pollutantData = result.data[latestTimestamp].slice(3);

            // 从污染物数据中提取数值
            let valueMap = {};
            pollutantData.forEach(entry => {
                const pollutantId = entry[0];
                const value = entry[1];
                const name = components[pollutantId]?.name || `ID ${pollutantId}`;
                valueMap[name] = value;
            });

            //  从值中提取目标污染物（默认为 0）
            const NO2 = valueMap["NO2"] || 0;
            const PM10 = valueMap["PM10"] || 0;
            const PM25 = valueMap["PM2"] || 0;
            const O3  = valueMap["O3"]  || 0;
            const color = getWorstIndexColor(NO2, PM10, PM2, O3);
            const latLng = [stationCoords[stationId].lat, stationCoords[stationId].lon];
            console.log("🧪 valueMap 检查", valueMap);

            //  使用 Leaflet CircleMarker
            const circle = L.circleMarker(latLng, {
                radius: 10,
                fillColor: color,
                fillOpacity: 0.8,
                color: "#333",
                weight: 1
            });

            // Tooltip（站点名）
            circle.bindTooltip(stationCoords[stationId].stationName || actualStationId, {
                permanent: false,
                sticky: true
            });

            // Popup 内容（详细数据）
            let popupContent = `<h3>${stationCoords[stationId].stationName}</h3><p><b>Messzeit:</b> ${actualTimestamp}</p>`;
            pollutantData.forEach(entry => {
                const pollutantId = entry[0];
                const value = entry[1];
                const pollutantInfo = components[pollutantId] || { name: `ID ${pollutantId}`, unit: "" };
                popupContent += `<p><b>${pollutantInfo.name}:</b> ${value} ${pollutantInfo.unit}</p>`;
            });

            // 点击显示右侧信息栏
            circle.on("click", () => {
                showDataInPanel(
                    stationCoords[stationId].stationName,
                    actualTimestamp,
                    pollutantData
                );
            });

            circle.addTo(map);
            mapMarkers[actualStationId] = circle;
        });
    });
}



function showDataInPanel(stationName, timestamp, pollutantData) {
  const wrapper = document.getElementById("info-panel");
  const content = document.getElementById("air-quality-panel");

  if (!wrapper || !content) return;

  // 用你原来的 popupContent 逻辑生成右栏内容
  let html = `<h3>${stationName}</h3><p><b>Messzeit:</b> ${timestamp}</p>`;
  pollutantData.forEach(entry => {
    const pollutantId = entry[0];
    const value = entry[1];
    const pollutantInfo = components[pollutantId] || { name: `ID ${pollutantId}`, unit: "" };
    html += `<p><b>${pollutantInfo.name}:</b> ${value} ${pollutantInfo.unit}</p>`;
  });

  content.innerHTML = html;
  wrapper.classList.add("visible");
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

