const API_BASE_URL = "https://datenplattform-essen.netlify.app/.netlify/functions/ubaProxy?";
let stationCoords = {}; // 存储Essen的测量站点
let components = {}; // 存储污染物 ID → 名称
let mapMarkers = {};
// 1️⃣ 获取测量站坐标（Essen）
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

            console.log("📌 Alle Messstationen Daten:", data);

            // 🚀 **确保 `data.data` 是数组**
            let stations = Array.isArray(data.data) ? data.data : Object.values(data.data);

            // 过滤出 Essen 
            let filteredStations = stations.filter(entry => 
                entry[3] === "Essen" && entry[6] === null
            );
            
            // 先检查是否有匹配的 Essen 站点
            console.log("📌 过滤后的 Essen 站点:", filteredStations);
            // `3` 是城市名称字段

            if (filteredStations.length === 0) {
                console.warn("⚠️ Keine Messstationen für Essen gefunden!");
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

            console.log("📍 Stationen in Essen gespeichert:", stationCoords);
        })
        .catch(error => {
            console.error('Fehler beim Abrufen der Messstationen:', error);
        });
}

// 2️⃣ 获取当前时间
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

// 3️⃣ 获取空气质量数据
function fetchAirQualityData(stationId) {
    const { date, hour } = getCurrentTime();
    const apiUrl = `${API_BASE_URL}api=airQuality&date_from=${date}&date_to=${date}&time_from=${hour}&time_to=${hour}&station=${stationId}`;

    console.log(`📡 API Anfrage für ${stationId}: ${apiUrl}`);
    return fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
        console.log(`📌 API Antwort für ${stationId}:`, data);

        if (!data || !data.data) {
            console.warn(`⚠️ Keine Luftqualitätsdaten für ${stationId}`);
            return null;
        }

        const actualStationId = data.request?.station; // 确保 ID 正确
        console.log(`✅ Station ID Mapping: ${stationId} → ${actualStationId}`);

        return { stationId: actualStationId, data: data.data[0] };
    })
        .catch(error => {
            console.error(`❌ Fehler beim Laden der Luftqualität für ${stationId}:`, error);
            return null;
        });
}

// 获取污染物 ID → 名称
fetch("./components.json") // 确保路径正确
    .then(response => response.json())
    .then(data => {
        console.log("📌 Komponenten JSON Datei geladen:", data);

        if (!data || !data[1]) {
            console.warn("⚠️ Keine gültigen Schadstoffdaten gefunden!");
            return;
        }

        // 遍历 JSON 数据，将污染物 ID 映射到名称和单位
        Object.values(data).forEach(entry => {
            const pollutantId = entry[0]; // 例如 "1"
            const pollutantName = entry[2]; // 例如 "PM10"
            const pollutantUnit = entry[3]; // 例如 "µg/m³"

            components[pollutantId] = { name: pollutantName, unit: pollutantUnit };
        });

        console.log("📍 Schadstoff-Komponenten gespeichert:", components);
    })
    .catch(error => {
        console.error("❌ Fehler beim Laden der Schadstoff-Komponenten:", error);
    });

// 4️⃣ 在地图上添加测量站点
function addStationsToMap() {
    Object.keys(stationCoords).forEach(stationId => {
        fetchAirQualityData(stationId).then(result => {
            if (!result || !result.data) {
                console.warn(`⚠️ Keine Luftqualitätsdaten ${stationId}`);
                return;
            }
            let actualStationId = result.stationId;
            let timestamps = Object.keys(result.data);
            if (timestamps.length === 0) {
                console.warn(`⚠️ Keine Messwerte für ${actualStationId}`);
                return;
            }

            let latestTimestamp = timestamps[timestamps.length-1];
            let actualTimestamp = result.data[latestTimestamp][0];
            let pollutantData = result.data[latestTimestamp].slice(3);//跳过前三项

            // 构建弹窗内容
            let popupContent = `<h3>Messstation ${actualStationId}</h3><p><b>Messzeit:</b> ${actualTimestamp}</p>`;
            pollutantData.forEach(entry => {
                let pollutantId = entry[0]; // 例如 3
                let value = entry[1]; // 例如 50.2
                let pollutantInfo = components[pollutantId] || { name: `ID ${pollutantId}`, unit: "" };

                popupContent += `<p><b>${pollutantInfo.name}:</b> ${value} ${pollutantInfo.unit}</p>`;
            });
            // 创建 Leaflet Marker
            let latLng = [stationCoords[stationId].lat, stationCoords[stationId].lon];
            let marker = L.marker(latLng).bindPopup(popupContent);

            if (!marker) {
                console.error(`❌ Fehler: Marker für ${stationId} ist undefined`);
                return;
            }

            console.log(`📍 Station ${actualStationId} Marker erstellt:`, marker);
            marker.on("click", () => showDataInPanel(actualStationId, latestTimestamp, pollutantData));
            marker.addTo(map);
            mapMarkers[actualStationId] = marker;
        });
    });
}

// 5️⃣ 在右侧面板显示空气质量数据
function showDataInPanel(stationName, timestamp, pollutantData) {
    console.log(`📊 Daten für Station ${stationName} werden im Panel angezeigt`);
    let panel = document.getElementById("air-quality-panel");

    if (!panel) {
        console.error("❌ Fehler: Element mit ID 'air-quality-panel' nicht gefunden");
        return;
    }

    panel.innerHTML = `<h2>Messstation ${stationName}</h2><p><b>Zeit:</b> ${timestamp}</p>`;
    pollutantData.forEach(entry => {
        panel.innerHTML += `<p><b>ID ${entry[0]}:</b> ${entry[1]} µg/m³</p>`;
    });
    panel.style.display = "block";
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