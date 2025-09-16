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

    // 🌡️ 插入 min/max 温度
    document.getElementById('temp-min').textContent = `${minTemp}°C`;
    document.getElementById('temp-max').textContent = `${maxTemp}°C`;

  } catch (err) {
    console.error("Weather API failed:", err);
  }
}

fetchWeather();
