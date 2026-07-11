function getNextbikeElements() {
  const elements = {
    available: document.getElementById("nb-available"),
    total: document.getElementById("nb-total"),
    topFree: document.getElementById("nb-top-free"),
    topLow: document.getElementById("nb-top-low")
  };

  if (Object.values(elements).some(element => !element)) {
    throw new Error("Nextbike card elements are missing from the page");
  }

  return elements;
}

function showNextbikeUnavailable(elements) {
  Object.values(elements).forEach(element => {
    element.textContent = "Nicht verfügbar";
    element.title = "Nicht verfügbar";
  });
}

async function fetchNextbike() {
  let elements;

  try {
    elements = getNextbikeElements();
    const response = await fetch("/.netlify/functions/mobilityProxy");

    if (!response.ok) {
      throw new Error(`Proxy returned ${response.status} ${response.statusText}`.trim());
    }

    const city = await response.json();
    const places = Array.isArray(city.places) ? city.places : [];

    if (!Number.isFinite(city.available_bikes) ||
        !Number.isFinite(city.set_point_bikes) ||
        places.length === 0) {
      throw new Error("Proxy returned invalid Nextbike data");
    }

    elements.available.textContent = city.available_bikes;
    elements.total.textContent = city.set_point_bikes;

    // 空位最多 Top1
    const topFree = [...places].sort((a,b)=> (b.free_racks||0) - (a.free_racks||0))[0];
    const freeText = `${topFree.name} (${topFree.free_racks||0})`;
    elements.topFree.textContent = freeText;
    elements.topFree.title = freeText;

    // 车辆最少 Top1
    const topLow = [...places].sort((a,b)=> (a.bikes||0) - (b.bikes||0))[0];
    const lowText = `${topLow.name} (${topLow.bikes||0})`;
    elements.topLow.textContent = lowText;
    elements.topLow.title = lowText;
  } catch (err) {
    if (elements) {
      showNextbikeUnavailable(elements);
    }
    console.error("Nextbike API Fehler:", err);
  }
}

document.addEventListener("DOMContentLoaded", fetchNextbike);
