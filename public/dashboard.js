Promise.all([
  fetch("https://api.nextbike.net/maps/nextbike-live.json?city=133").then(r => r.json()),
  fetch("https://api.open-meteo.com/v1/forecast?latitude=51.45&longitude=7.01&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,uv_index,cloud_cover").then(r => r.json())
])
.then(([bikeData, weatherData]) => {
  // Nextbike
  const city = bikeData.countries[0].cities.find(c => c.uid === 133);
  document.getElementById("nb-available").textContent = city.available_bikes;
  document.getElementById("nb-total").textContent = city.set_point_bikes;

  // Wetter
  const weather = weatherData.current;
  document.getElementById('apparent-temp').textContent = `${weather.apparent_temperature}°C`;
  document.getElementById('humidity').textContent = `${weather.relative_humidity_2m}%`;
  document.getElementById('wind').textContent = `${weather.wind_speed_10m} m/s`;
  document.getElementById('wind-dir').style.transform = `rotate(${weather.wind_direction_10m}deg)`;
  document.getElementById('rain').textContent = `${weather.precipitation} mm`;
  document.getElementById('uv').textContent = weather.uv_index;
  document.getElementById('cloud').textContent = `${weather.cloud_cover}%`;
})
.catch(err => console.error("API Fehler:", err));
