/**
 * SkyCast — Utilities Module
 * ═══════════════════════════════════════════════════════════════
 * Pure helper functions — zero DOM access, zero side effects.
 *
 * Exports:
 *   getWeatherInfo(code, isDay) → { text, emoji, theme }
 *   fmtTemp(celsius, unit)      → number
 *   fmtTime(isoStr, tz)         → "2:30 PM"
 *   fmtHour(isoStr)             → "2 PM" / "Now"
 *   fmtDate(dateStr)            → "Today" / "Mon, Jun 5"
 *   fmtDatetime(tz)             → full locale datetime string
 *   windDir(degrees)            → "NNW"
 *   uvLevel(v)                  → { text, cls }
 *   aqiLevel(v)                 → { text, cls }
 *   visLevel(meters)            → string
 *   pressureTrend(hpa)          → string
 *   nowHourIdx(times, tz)       → number (index into hourly array)
 * ═══════════════════════════════════════════════════════════════
 */

const Utils = (() => {

  /* ═══════════════════════════════════════════════════════════
     WMO WEATHER INTERPRETATION CODE TABLE
     Source: https://open-meteo.com/en/docs (WMO 4677)

     Each entry maps a WMO code to:
       text  — Human-readable description
       emoji — Visual icon (emoji, works everywhere)
       theme — CSS theme class suffix for dynamic backgrounds
                 sunny | cloudy | rainy | snowy | stormy | foggy | night
  ═══════════════════════════════════════════════════════════ */
  const WMO = {
    0:  { text: 'Clear Sky',                  emoji: '☀️',  theme: 'sunny'  },
    1:  { text: 'Mainly Clear',               emoji: '🌤️', theme: 'sunny'  },
    2:  { text: 'Partly Cloudy',              emoji: '⛅',  theme: 'cloudy' },
    3:  { text: 'Overcast',                   emoji: '☁️',  theme: 'cloudy' },
    45: { text: 'Foggy',                      emoji: '🌫️', theme: 'foggy'  },
    48: { text: 'Depositing Rime Fog',        emoji: '🌫️', theme: 'foggy'  },
    51: { text: 'Light Drizzle',              emoji: '🌦️', theme: 'rainy'  },
    53: { text: 'Moderate Drizzle',           emoji: '🌦️', theme: 'rainy'  },
    55: { text: 'Dense Drizzle',              emoji: '🌧️', theme: 'rainy'  },
    56: { text: 'Freezing Drizzle',           emoji: '🌨️', theme: 'snowy'  },
    57: { text: 'Heavy Freezing Drizzle',     emoji: '🌨️', theme: 'snowy'  },
    61: { text: 'Slight Rain',                emoji: '🌧️', theme: 'rainy'  },
    63: { text: 'Moderate Rain',              emoji: '🌧️', theme: 'rainy'  },
    65: { text: 'Heavy Rain',                 emoji: '🌧️', theme: 'rainy'  },
    66: { text: 'Light Freezing Rain',        emoji: '🌨️', theme: 'snowy'  },
    67: { text: 'Heavy Freezing Rain',        emoji: '🌨️', theme: 'snowy'  },
    71: { text: 'Slight Snowfall',            emoji: '🌨️', theme: 'snowy'  },
    73: { text: 'Moderate Snowfall',          emoji: '❄️',  theme: 'snowy'  },
    75: { text: 'Heavy Snowfall',             emoji: '❄️',  theme: 'snowy'  },
    77: { text: 'Snow Grains',                emoji: '🌨️', theme: 'snowy'  },
    80: { text: 'Slight Rain Showers',        emoji: '🌦️', theme: 'rainy'  },
    81: { text: 'Moderate Rain Showers',      emoji: '🌧️', theme: 'rainy'  },
    82: { text: 'Violent Rain Showers',       emoji: '⛈️', theme: 'stormy' },
    85: { text: 'Slight Snow Showers',        emoji: '🌨️', theme: 'snowy'  },
    86: { text: 'Heavy Snow Showers',         emoji: '❄️',  theme: 'snowy'  },
    95: { text: 'Thunderstorm',               emoji: '⛈️', theme: 'stormy' },
    96: { text: 'Thunderstorm with Hail',     emoji: '⛈️', theme: 'stormy' },
    99: { text: 'Thunderstorm + Heavy Hail',  emoji: '⛈️', theme: 'stormy' }
  };

  /**
   * getWeatherInfo
   * Resolves a WMO code to display metadata.
   * Handles the special night case for clear-sky codes.
   *
   * @param {number} code   — WMO weather code from Open-Meteo
   * @param {0|1}    isDay  — 1 if daytime, 0 if night (from API)
   * @returns {{ text:string, emoji:string, theme:string }}
   */
  function getWeatherInfo(code, isDay = true) {
    const info = WMO[code] || { text: 'Unknown', emoji: '🌡️', theme: 'cloudy' };

    // Night-time override for clear/mainly-clear only
    if (!isDay && (code === 0 || code === 1)) {
      return {
        ...info,
        emoji: '🌙',
        text : code === 0 ? 'Clear Night' : 'Mainly Clear Night',
        theme: 'night'
      };
    }
    return info;
  }

  /* ═══════════════════════════════════════════════════════════
     TEMPERATURE
  ═══════════════════════════════════════════════════════════ */

  /**
   * fmtTemp
   * Converts and rounds a Celsius value.
   * Returns '--' if value is null/undefined.
   *
   * @param {number|null} celsius
   * @param {'C'|'F'}     unit
   * @returns {number|string}
   */
  function fmtTemp(celsius, unit = 'C') {
    if (celsius === null || celsius === undefined) return '--';
    const val = unit === 'F' ? (celsius * 9) / 5 + 32 : celsius;
    return Math.round(val);
  }

  /* ═══════════════════════════════════════════════════════════
     TIME & DATE FORMATTERS
  ═══════════════════════════════════════════════════════════ */

  /**
   * fmtTime — "2:30 PM" in the location's local timezone.
   * Used for sunrise/sunset display.
   *
   * @param {string} iso  — ISO datetime string (e.g. "2024-06-05T05:42")
   * @param {string} tz   — IANA timezone (e.g. "Europe/London")
   */
  function fmtTime(iso, tz) {
    if (!iso) return '--:--';
    try {
      return new Date(iso).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit',
        hour12: true, timeZone: tz
      });
    } catch {
      return '--:--';
    }
  }

  /**
   * fmtHour — "2 PM", "12 AM", "12 PM" (no minutes).
   * Used in the hourly forecast rail.
   *
   * @param {string} iso  — e.g. "2024-06-05T14:00"
   */
  function fmtHour(iso) {
    if (!iso) return '--';
    try {
      const h = new Date(iso).getHours();
      if (h === 0)  return '12 AM';
      if (h === 12) return '12 PM';
      return h < 12 ? `${h} AM` : `${h - 12} PM`;
    } catch {
      return '--';
    }
  }

  /**
   * fmtDate — "Today", "Tomorrow", or "Mon, Jun 5"
   * Used in the 7-day daily forecast.
   *
   * @param {string} dateStr — YYYY-MM-DD
   */
  function fmtDate(dateStr) {
    if (!dateStr) return '--';
    try {
      // Use noon to avoid timezone-edge date shifts
      const d  = new Date(dateStr + 'T12:00:00');
      const td = new Date();
      const tm = new Date(td);
      tm.setDate(td.getDate() + 1);

      if (d.toDateString() === td.toDateString()) return 'Today';
      if (d.toDateString() === tm.toDateString()) return 'Tomorrow';

      return d.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  /**
   * fmtDatetime — Full datetime in location's timezone.
   * "Monday, June 5, 2026 at 2:30 PM"
   * Updates live every minute via setInterval in app.js.
   *
   * @param {string} tz — IANA timezone string
   */
  function fmtDatetime(tz) {
    try {
      return new Date().toLocaleDateString('en-US', {
        weekday : 'long',
        year    : 'numeric',
        month   : 'long',
        day     : 'numeric',
        hour    : '2-digit',
        minute  : '2-digit',
        timeZone: tz
      });
    } catch {
      // Fallback without timezone conversion
      return new Date().toLocaleDateString('en-US', {
        weekday : 'long',
        year    : 'numeric',
        month   : 'long',
        day     : 'numeric',
        hour    : '2-digit',
        minute  : '2-digit'
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     WIND DIRECTION
  ═══════════════════════════════════════════════════════════ */

  /**
   * windDir — Converts a bearing in degrees to a compass label.
   * Uses 16-point compass rose.
   *
   * @param {number} degrees — 0–360
   * @returns {string} e.g. "NNW", "SE", "E"
   */
  function windDir(degrees) {
    const dirs = [
      'N','NNE','NE','ENE',
      'E','ESE','SE','SSE',
      'S','SSW','SW','WSW',
      'W','WNW','NW','NNW'
    ];
    return dirs[Math.round((degrees % 360) / 22.5) % 16] || 'N';
  }

  /* ═══════════════════════════════════════════════════════════
     LEVEL DESCRIPTORS
     Each returns { text: string, cls: string }
     where cls is a CSS class applied to the subtitle element.
  ═══════════════════════════════════════════════════════════ */

  /**
   * uvLevel — WHO UV Index categories.
   * 0–2 Low | 3–5 Moderate | 6–7 High | 8–10 Very High | 11+ Extreme
   */
  function uvLevel(v) {
    if (v === null || v === undefined) return { text: '--',        cls: ''         };
    if (v <= 2)  return { text: 'Low',       cls: 'lvl-good' };
    if (v <= 5)  return { text: 'Moderate',  cls: 'lvl-mod'  };
    if (v <= 7)  return { text: 'High',      cls: 'lvl-high' };
    if (v <= 10) return { text: 'Very High', cls: 'lvl-bad'  };
    return              { text: 'Extreme',   cls: 'lvl-bad'  };
  }

  /**
   * aqiLevel — European AQI (EAQI) bands.
   * 0–20 Good | 20–40 Fair | 40–60 Moderate | 60–80 Poor | 80+ Very Poor
   */
  function aqiLevel(v) {
    if (v === null || v === undefined) return { text: 'N/A',       cls: ''         };
    if (v <= 20) return { text: 'Good',      cls: 'lvl-good' };
    if (v <= 40) return { text: 'Fair',      cls: 'lvl-good' };
    if (v <= 60) return { text: 'Moderate',  cls: 'lvl-mod'  };
    if (v <= 80) return { text: 'Poor',      cls: 'lvl-high' };
    if (v <=100) return { text: 'Very Poor', cls: 'lvl-bad'  };
    return              { text: 'Hazardous', cls: 'lvl-bad'  };
  }

  /**
   * visLevel — Meteorological visibility bands.
   * @param {number} meters — visibility in meters (from Open-Meteo)
   */
  function visLevel(meters) {
    const km = meters / 1000;
    if (km >= 10) return 'Excellent';
    if (km >= 5)  return 'Good';
    if (km >= 2)  return 'Moderate';
    if (km >= 1)  return 'Poor';
    return 'Very Poor';
  }

  /**
   * pressureTrend — Qualitative description of mean sea-level pressure.
   * @param {number} hpa — pressure in hPa (hectopascals)
   */
  function pressureTrend(hpa) {
    if (hpa > 1022) return 'High — Fair weather';
    if (hpa > 1013) return 'Normal';
    if (hpa > 1000) return 'Low — Clouds likely';
    return 'Very Low — Storm likely';
  }

  /* ═══════════════════════════════════════════════════════════
     CURRENT HOUR INDEX
     Finds which index in the hourly data array corresponds
     to the current hour at the weather location.

     Open-Meteo returns hourly times in the location's local
     timezone (because we pass timezone=auto). So we compare
     current local time at that timezone vs the time strings.

     Strategy: use the 'sv-SE' locale to get a sortable
     "YYYY-MM-DD HH:MM:SS" string, then slice to YYYY-MM-DD HH
     and do a string comparison with the hourly array entries.
  ═══════════════════════════════════════════════════════════ */

  /**
   * nowHourIdx
   * @param {string[]} times  — Array of "YYYY-MM-DDTHH:00" strings
   * @param {string}   tz     — IANA timezone (e.g. "Asia/Tokyo")
   * @returns {number}         — Index of the current/next hour in array
   */
  function nowHourIdx(times, tz) {
    try {
      // Get current local time at location as "YYYY-MM-DD HH"
      const localNow = new Date()
        .toLocaleString('sv-SE', { timeZone: tz }) // → "2024-06-05 14:23:00"
        .slice(0, 13);                              // → "2024-06-05 14"

      for (let i = 0; i < times.length; i++) {
        // Open-Meteo format: "2024-06-05T14:00" → normalize to "2024-06-05 14"
        const t = times[i].replace('T', ' ').slice(0, 13);
        if (t >= localNow) return i;
      }
    } catch {
      // Fallback: compare against UTC ISO string
      const utcNow = new Date().toISOString().slice(0, 13); // "2024-06-05T14"
      for (let i = 0; i < times.length; i++) {
        if (times[i].slice(0, 13) >= utcNow) return i;
      }
    }
    return 0; // Safe fallback — start from beginning of array
  }

  /* ─────────────────────────────────────────
     Public surface
  ───────────────────────────────────────── */
  return {
    getWeatherInfo,
    fmtTemp,
    fmtTime,
    fmtHour,
    fmtDate,
    fmtDatetime,
    windDir,
    uvLevel,
    aqiLevel,
    visLevel,
    pressureTrend,
    nowHourIdx
  };

})();
