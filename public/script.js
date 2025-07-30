//  创建地图，默认Düsseldorf
var map;

document.addEventListener("DOMContentLoaded", function() {
    map = L.map('map', {
        center: [51.2277, 6.7735], // Essen 的坐标
        zoom: 12,
        zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

        //  绑定搜索功能
    setupSearch();

    //  加载 `GeoJSON`，但初始时不添加到地图
    initializeGeoJSONLayers();

    //  侧边栏控制逻辑
    var sidebar = document.getElementById("sidebar-container");
    var menuToggle = document.getElementById("menu-toggle");

    menuToggle.addEventListener("click", function() {
        sidebar.classList.toggle("active");
    });
    
    document.getElementById("stadtteile").addEventListener("change", function (e) {
        const checked = e.target.checked;
        const layer = layerGroups["stadtteile"];
        if (checked && layer) {
            map.addLayer(layer);
        } else if (layer) {
            map.removeLayer(layer);
        }
    });
});

// 存储 GeoJSON 图层（但不默认添加到地图）
const layerGroups = {};

function initializeGeoJSONLayers() {
    const geojsonFiles = [
        { url: "supabase", color: "green", name: "stadtteile" },
        // 如果有其他本地文件也可以继续放在这里
    ];

    geojsonFiles.forEach(file => {
        //  来自 Supabase
        if (file.url === "supabase") {
                fetch("/.netlify/functions/supabaseProxy")
                .then(response => response.json())
                .then(data => {
                    console.log("Supabase 返回数据：", data);
                    const features = data.map(entry => ({
                        type: "Feature",
                        geometry: entry.geometry,
                        properties: {
                            name: entry.name,
                            nummer: entry.nummer,
                            id: entry.id
                        }
                    }));

                    let layer = L.geoJSON({ type: "FeatureCollection", features }, {
                        style: {
                            color: "#3366cc",
                            weight: 2,
                            fillOpacity: 0
                        },
                        onEachFeature: function (feature, layer) {
                            if (feature.properties && feature.properties.name) {
                                layer.bindPopup(`<b>${file.name}:</b> ${feature.properties.name}`);
                            }
                        }
                    });
                    layerGroups[file.name] = layer;

                })
                .catch(error => console.error(`❌ Fehler beim Laden von Supabase (${file.name}):`, error));

        } else {
            //  本地文件
            fetch(file.url)
                .then(response => response.json())
                .then(data => {
                    console.log(`Geladene Daten von ${file.name}:`, data);

                    let layer = L.geoJSON(data, {
                        style: function (feature) {
                            return { color: file.color, weight: 2, fillOpacity: 0.3 };
                        },
                        pointToLayer: function (feature, latlng) {
                            return L.circleMarker(latlng, { radius: 6, color: file.color });
                        },
                        onEachFeature: function (feature, layer) {
                            if (feature.properties && feature.properties.name) {
                                layer.bindPopup(`<b>${file.name}:</b> ${feature.properties.name}`);
                            }
                        }
                    });

                    layerGroups[file.name] = layer;
                })
                .catch(error => console.error(`❌ Fehler beim Laden von ${file.name}:`, error));
        }
    });

    //  绑定左侧菜单栏复选框（如有）
    setupLayerToggle();
}


//  复选框控制数据可见性
function setupLayerToggle() {
    document.querySelectorAll('#data-layer-list input').forEach(input => {
        input.addEventListener('change', function() {
            if (this.checked) {
                map.addLayer(layerGroups[this.id]); // 添加图层到地图
            } else {
                map.removeLayer(layerGroups[this.id]); // 从地图移除
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
