//  创建地图，默认Düsseldorf
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
                        console.warn("⚠️ Supabase 返回了空数组 (stadtteile).");
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
                    console.log(`✅ Layer ${file.name} 已创建`);
                })
                .catch(error => console.error(`❌ Fehler beim Laden von Supabase (${file.name}):`, error));
        }
    });

    // 等数据加载完成后再绑定复选框
    setupLayerToggle();
}


// 复选框控制数据可见性
function setupLayerToggle() {
    const checkboxes = document.querySelectorAll('#data-layer-list input');
    checkboxes.forEach(input => {
        input.addEventListener('change', function() {
            const layer = layerGroups[this.id];
            console.log(`处理复选框变更: ${this.id}, 勾选状态: ${this.checked}`);
            console.log('对应的图层对象:', layer);
 
            if (layer) {
                if (this.checked) {
                    map.addLayer(layer); // 添加图层到地图
                    console.log(`图层 ${this.id} 已添加到地图`);
                } else {
                    map.removeLayer(layer); // 从地图移除
                    console.log(`图层 ${this.id} 已从地图移除`);
                }
            } else {
                console.error(`未找到对应的图层: ${this.id}`);
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

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const show = params.get("show");

  if (show === "airquality") {
    // 👉 打开左侧栏（强制可见）
    const sidebarContainer = document.getElementById("sidebar-container");
    if (sidebarContainer) {
      sidebarContainer.style.display = "block";
    }
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
      sidebar.classList.add("visible");
    }

    // 👉 等待 checkbox 渲染后勾选 Luftqualität
    const interval = setInterval(() => {
      const luftCheckbox = document.getElementById("air-quality");
      if (luftCheckbox) {
        if (!luftCheckbox.checked) {
          luftCheckbox.checked = true;
          luftCheckbox.dispatchEvent(new Event("change")); // 触发 addStationsToMap()
        }
        clearInterval(interval);
      }
    }, 500);
  }
});
