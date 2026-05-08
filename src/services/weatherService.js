const BANGALORE = { lat: 12.9716, lon: 77.5946 };
const KEY = import.meta.env.VITE_OPENWEATHER_KEY;
const BASE = "https://api.openweathermap.org/data/2.5/weather";

export async function getWeather() {
  try {
    const res = await fetch(
      `${BASE}?lat=${BANGALORE.lat}&lon=${BANGALORE.lon}&appid=${KEY}&units=metric`
    );
    if (!res.ok) {
      console.error(`[Weather API Error] ${res.status}:`, await res.text());
      return "weather data unavailable";
    }
    const data = await res.json();
    const desc = data.weather[0].description;
    const temp = data.main.temp;
    const humidity = data.main.humidity;
    return `${desc}, ${Math.round(temp)}°C, humidity ${humidity}%`;
  } catch (err) {
    console.error("[Weather Fetch Failure]:", err);
    return "weather data unavailable";
  }
}

export async function isRaining() {
  try {
    const res = await fetch(
      `${BASE}?lat=${BANGALORE.lat}&lon=${BANGALORE.lon}&appid=${KEY}`
    );
    if (!res.ok) {
      console.error(`[Weather API Error (Rain Check)] ${res.status}:`, await res.text());
      return false;
    }
    const data = await res.json();
    const id = data.weather[0].id;
    // WMO codes: 2xx=thunderstorm, 3xx=drizzle, 5xx=rain, 6xx=snow
    return id >= 200 && id < 700;
  } catch (err) {
    console.error("[Weather Rain Check Failure]:", err);
    return false;
  }
}
