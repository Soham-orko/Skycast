/**
 * SkyCast — API Module
 * ═══════════════════════════════════════════════════════════════
 * 100% FREE  |  No API key  |  No hard rate limits
 *
 * Data Sources Used:
 *  ① Weather data    → Open-Meteo          api.open-meteo.com
 *  ② City search     → Open-Meteo Geocoding  geocoding-api.open-meteo.com
 *  ③ Air quality     → Open-Meteo AQI      air-quality-api.open-meteo.com
 *  ④ Reverse geocode → Nominatim OSM       nominatim.openstreetmap.org
 *
 * All APIs are public, require no registration, and have
 * generous or unlimited usage for non-commercial use.
 * ═══════════════════════════════════════════════════════════════
 */

const API = (() => {

  const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
  const GEO_URL     = 'https://geocoding-api.open-meteo.com/v1/search';
  const AQI_URL     = 'https://air-quality-api.open-meteo.com/v1/air-quality';
  const REVGEO_URL  = 'https://nominatim.openstreetmap.org/reverse';

  /* ─────────────────────────────────────────
     Internal helper — fetch JSON with error
  ───────────────────────────────────────── */
  async function fetchJSON(url, opts = {}) {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url.split('?')[0]}`);
    return res.json();
  }

  /* ═══════════════════════════════════════════════════════════
     searchCities
     City autocomplete using Open-Meteo Geocoding.

     Returns array of objects with:
       { name, admin1, country, latitude, longitude, timezone }

     No key needed. ~100 ms response time. Works worldwide.
  ═══════════════════════════════════════════════════════════ */
  async function searchCities(query, count = 8) {
    if (!query || query.trim().length < 2) return [];
    try {
      const url = `${GEO_URL}?name=${encodeURIComponent(query.trim())}`
                + `&count=${count}&language=en&format=json`;
      const data = await fetchJSON(url);
      return data.results || [];
    } catch (err) {
      console.warn('[API] searchCities failed:', err.message);
      return [];
    }
  }

  /* ═══════════════════════════════════════════════════════════
     getWeather
     Full weather data from Open-Meteo for a lat/lon pair.

     Fetches in one request:
       current  — temperature, humidity, wind, pressure,
                  visibility, cloud cover, weather code, is_day
       hourly   — 7 days × 24 h of temperature, precipitation
                  probability, weather code, UV, wind, is_day
       daily    — 7 days of max/min temp, sunrise/sunset, UV,
                  precipitation sum + probability, wind

     timezone=auto  → Open-Meteo auto-detects from coordinates.
     wind_speed_unit=kmh → ensures km/h globally (not mph or m/s).
  ═══════════════════════════════════════════════════════════ */
  async function getWeather(lat, lon) {
    const p = new URLSearchParams({
      latitude        : lat,
      longitude       : lon,
      timezone        : 'auto',
      forecast_days   : 7,
      wind_speed_unit : 'kmh',

      // ── Current conditions ──────────────────────────────────
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'weather_code',
        'cloud_cover',
        'pressure_msl',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
        'visibility'
      ].join(','),

      // ── Hourly (7 × 24 = 168 data points per variable) ─────
      hourly: [
        'temperature_2m',
        'apparent_temperature',
        'precipitation_probability',
        'precipitation',
        'weather_code',
        'wind_speed_10m',
        'visibility',
        'uv_index',
        'is_day'
      ].join(','),

      // ── Daily summaries ─────────────────────────────────────
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'sunrise',
        'sunset',
        'precipitation_sum',
        'precipitation_probability_max',
        'uv_index_max',
        'wind_speed_10m_max',
        'wind_direction_10m_dominant'
      ].join(',')
    });

    return fetchJSON(`${WEATHER_URL}?${p}`);
  }

  /* ═══════════════════════════════════════════════════════════
     getAQI
     European Air Quality Index + key pollutant concentrations.
     Returns null on failure (non-critical — dashboard still
     works without it, showing "N/A" for the AQI card).

     european_aqi scale:
       0–20  Good | 20–40 Fair | 40–60 Moderate
       60–80 Poor | 80–100 Very Poor | 100+ Extremely Poor
  ═══════════════════════════════════════════════════════════ */
  async function getAQI(lat, lon) {
    try {
      const p = new URLSearchParams({
        latitude  : lat,
        longitude : lon,
        timezone  : 'auto',
        current   : [
          'european_aqi',
          'pm10',
          'pm2_5',
          'carbon_monoxide',
          'nitrogen_dioxide',
          'ozone'
        ].join(',')
      });
      return await fetchJSON(`${AQI_URL}?${p}`);
    } catch (err) {
      console.warn('[API] getAQI failed (non-critical):', err.message);
      return null;
    }
  }

  /* ═══════════════════════════════════════════════════════════
     reverseGeocode
     Converts a lat/lon pair into a human-readable city name
     using Nominatim (OpenStreetMap's free geocoder).

     Falls back gracefully to coordinate strings if the
     request fails — the app always shows something.

     ⚠  Nominatim usage policy: include a User-Agent header
        that identifies your app (done here). Max 1 request/sec.
        Only used on browser geolocation — not on every render.
  ═══════════════════════════════════════════════════════════ */
  async function reverseGeocode(lat, lon) {
    try {
      const url  = `${REVGEO_URL}?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
      const data = await fetchJSON(url, {
        headers: { 'User-Agent': 'SkyCast-Weather-Dashboard/1.0 (github.com/skycast)' }
      });

      const a = data.address || {};
      return {
        city   : a.city || a.town || a.village || a.county || a.state || 'Unknown',
        country: a.country || '',
        code   : (a.country_code || '').toUpperCase()
      };
    } catch (err) {
      console.warn('[API] reverseGeocode failed:', err.message);
      // Graceful fallback — show raw coordinates
      return {
        city   : `${parseFloat(lat).toFixed(2)}°N`,
        country: `${parseFloat(lon).toFixed(2)}°E`,
        code   : ''
      };
    }
  }

  /* ─────────────────────────────────────────
     Public surface
  ───────────────────────────────────────── */
  return {
    searchCities,
    getWeather,
    getAQI,
    reverseGeocode
  };

})();
