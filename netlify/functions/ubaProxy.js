const fetch = require("node-fetch");

exports.handler = async function (event) {
    const { api, date_from, date_to, time_from, time_to, station} = event.queryStringParameters;

    if (!api) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Fehlende API-Parameter! Bitte geben Sie api an." })
        };
    }

    let apiUrl;
    if (api === "airQuality") {
        if (!date_from || !date_to || !time_from || !time_to || !station) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Fehlende Parameter! Bitte geben Sie date_from, date_to, time_from, time_to und station an." })
            };
        }
        apiUrl = `https://www.umweltbundesamt.de/api/air_data/v3/airquality/json?date_from=${date_from}&date_to=${date_to}&time_from=${time_from}&time_to=${time_to}&station=${station}`;
    
    } else if (api === "stationCoordinates") {
        apiUrl = `https://www.umweltbundesamt.de/api/air_data/v3/stations/json`;
    
    } else {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Ungültiger API-Parameter!" })
        };
    }

    console.log(`📡 API-Anfrage an: ${apiUrl}`);

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`API-Fehler: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // 🚀 **确保 `data.data` 是数组**
        let formattedData = Array.isArray(data.data) ? data.data : Object.values(data.data);

        console.log("📊 API Antwort (formatiert):", formattedData);

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ ...data, data: formattedData }) // ✅ 确保 `data.data` 是数组
        };
    } catch (error) {
        console.error(`❌ Fehler bei API-Anfrage an ${apiUrl}:`, error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API-Anfrage fehlgeschlagen", details: error.message })
        };
    }
};
