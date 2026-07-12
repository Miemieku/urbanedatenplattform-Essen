//  创建地图，默认显示 Essen
var map;

document.addEventListener("DOMContentLoaded", function() {
    map = L.map('map', {
        center: [51.4566, 7.0123], // Essen 的坐标
        zoom: 12,
        zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

        //  绑定搜索功能
    setupSearch();

    //  先绑定图层开关，再异步加载 `GeoJSON`
    setupLayerToggle();
    initializeGeoJSONLayers();

    //  侧边栏控制逻辑
    var sidebar = document.getElementById("sidebar-container");
    var menuToggle = document.getElementById("menu-toggle");

    menuToggle.addEventListener("click", function() {
        sidebar.classList.toggle("active");
    });
});

// 存储 GeoJSON 图层（但不默认添加到地图）
const layerGroups = {};

function initializeGeoJSONLayers() {
    const geojsonFiles = [
        { url: "supabase?type=stadtteile", color: "green", name: "stadtteile" },
        // 如果有其他本地文件也可以继续放在这里
    ];

    geojsonFiles.forEach(file => {
        if (file.url.startsWith("supabase")) {
            fetch(`/.netlify/functions/supabaseProxy?${file.url.split("?")[1]}`)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP Fehler: ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    console.log("📍 Supabase 返回数据 (stadtteile):", data);

                    if (!Array.isArray(data) || data.length === 0) {
                        resetLayerToggle(file.name);
                        console.error(`❌ Supabase 未返回有效图层数据 (${file.name}).`);
                        return;
                    }

                    const features = data.map(entry => ({
                        type: "Feature",
                        geometry: entry.geometry,
                        properties: {
                            name: entry.name,
                            nummer: entry.nummer,
                            id: entry.id
                        }
                    }));

                    const layer = L.geoJSON({ type: "FeatureCollection", features }, {
                        style: {
                            color: "#3366cc",
                            weight: 2,
                            fillOpacity: 0
                        },
                        onEachFeature: function (feature, layer) {
                            if (feature.properties && feature.properties.name) {
                                layer.bindPopup(`<b>Stadtteil:</b> ${feature.properties.name}`);
                            }
                        }
                    });

                    layerGroups[file.name] = layer;
                    syncLayerVisibility(file.name);
                    console.log(`✅ Layer ${file.name} 已创建`);
                })
                .catch(error => {
                    resetLayerToggle(file.name);
                    console.error(`❌ Fehler beim Laden von Supabase (${file.name}):`, error);
                });
        }
    });
}

// Stadtteile 复选框由这里唯一管理；Luftqualität 继续由 airQuality.js 管理
function setupLayerToggle() {
    const stadtteileToggle = document.getElementById("stadtteile");
    stadtteileToggle.addEventListener("change", function() {
        syncLayerVisibility(this.id);
    });
}

function syncLayerVisibility(layerName) {
    const toggle = document.getElementById(layerName);
    const layer = layerGroups[layerName];

    // 数据仍在加载时保留用户选择；加载完成后会再次调用本函数
    if (!toggle || !layer) return;

    if (toggle.checked && !map.hasLayer(layer)) {
        map.addLayer(layer);
    } else if (!toggle.checked && map.hasLayer(layer)) {
        map.removeLayer(layer);
    }
}

function resetLayerToggle(layerName) {
    const toggle = document.getElementById(layerName);
    if (toggle) toggle.checked = false;

    const layer = layerGroups[layerName];
    if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
    }
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

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const show = params.get("show");

  if (show === "airquality") {
    // 打开左侧栏
    const sidebarContainer = document.getElementById("sidebar-container");
    if (sidebarContainer) {
      sidebarContainer.style.display = "block";
    }
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
      sidebar.classList.add("visible");
    }

    // 等待 stationCoords 加载完成
    const waitForStations = setInterval(() => {
      if (Object.keys(stationCoords).length > 0) {
        const luftCheckbox = document.getElementById("air-quality");
        if (luftCheckbox) {
          luftCheckbox.checked = true;
          luftCheckbox.dispatchEvent(new Event("change")); // 触发 addStationsToMap()
        }
        clearInterval(waitForStations);
      }
    }, 500);
  }
});
