// 1️⃣ 创建地图，默认显示埃森（Essen）
var map;

document.addEventListener("DOMContentLoaded", function() {
    map = L.map('map', {
        center: [51.455643, 7.011555], // Essen 的坐标
        zoom: 12,
        zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

        // 📌 绑定搜索功能
    setupSearch();

    // ✅ 加载 `GeoJSON`，但初始时不添加到地图
    initializeGeoJSONLayers();

    // 🔹 侧边栏控制逻辑
    var sidebar = document.getElementById("sidebar-container");
    var menuToggle = document.getElementById("menu-toggle");

    menuToggle.addEventListener("click", function() {
        sidebar.classList.toggle("active");
    });
});

// 2️⃣ 存储 GeoJSON 图层（但不默认添加到地图）
const layerGroups = {}; 

function initializeGeoJSONLayers() {
    const geojsonFiles = [
        { url: "kitas_2024_2025.geojson", color: "green", name: "kindertagesstaetten" },
        { url: "Schulen_2024_2025.geojson", color: "blue", name: "schulen" },
        { url: "Stadtteile_WGS84.geojson", color: "green", name: "stadtteile" },
        { url: "Stadtbezirke_WGS84.geojson", color: "purple", name: "stadtbezirke" },
        { url: "Stadtgrenze_WGS84.geojson", color: "red", name: "stadtgrenze" }
    ];

    geojsonFiles.forEach(file => {
        fetch(file.url)
            .then(response => response.json())
            .then(data => {
                console.log(`Geladene Daten von ${file.name}:`, data);

                let layer = L.geoJSON(data, {
                    style: function(feature) {
                        return { color: file.color, weight: 2, fillOpacity: 0.3 };
                    },
                    pointToLayer: function(feature, latlng) {
                        return L.circleMarker(latlng, { radius: 6, color: file.color });
                    },
                    onEachFeature: function(feature, layer) {
                        if (feature.properties && feature.properties.name) {
                            layer.bindPopup(`<b>${file.name}:</b> ${feature.properties.name}`);
                        }
                    }
                });

                layerGroups[file.name] = layer; // ✅ 存储图层，但不 `addTo(map)`
            })
            .catch(error => console.error(`❌ Fehler beim Laden von ${file.name}:`, error));
    });

    // 3️⃣ 绑定左侧菜单栏复选框
    setupLayerToggle();
}

// 4️⃣ 复选框控制数据可见性
function setupLayerToggle() {
    document.querySelectorAll('#data-layer-list input').forEach(input => {
        input.addEventListener('change', function() {
            if (this.checked) {
                map.addLayer(layerGroups[this.id]); // ✅ 添加图层到地图
            } else {
                map.removeLayer(layerGroups[this.id]); // ✅ 从地图移除
            }
        });
    });
}

function setupSearch() {
    const searchBox = document.getElementById("search-box");
    const searchButton = document.getElementById("search-button");
    
    searchButton.addEventListener("click", function () {
        const address = searchBox.value;
        if (address) {
            searchAddress(address);
        } else {
            alert("Bitte geben Sie eine Adresse ein.");
        }
    });

    // 允许用户按 "Enter" 触发搜索
    searchBox.addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            searchButton.click();
        }
    });
}

function searchAddress(address) {
    // 使用 OSM Nominatim API 进行地址查询
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                const lat = data[0].lat;
                const lon = data[0].lon;
                console.log(`Adresse gefunden: ${lat}, ${lon}`);

                // 清除之前的标记
                if (window.searchMarker) {
                    map.removeLayer(window.searchMarker);
                }

                // 在地图上显示地址位置
                window.searchMarker = L.marker([lat, lon]).addTo(map)
                    .bindPopup(`<b>${address}</b><br>Latitude: ${lat}<br>Longitude: ${lon}`)
                    .openPopup();

                // 地图聚焦到新位置
                map.setView([lat, lon], 15);
            } else {
                alert("Adresse nicht gefunden. Bitte versuchen Sie es mit einer genaueren Eingabe.");
            }
        })
        .catch(error => console.error("Fehler beim Suchen der Adresse:", error));
}
