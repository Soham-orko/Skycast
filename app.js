/**
 * SkyCast — Main Application
 * ═══════════════════════════════════════════════════════════════
 * Dependency order (loaded in index.html):
 *   api.js   → API    (data fetching)
 *   utils.js → Utils  (pure helpers)
 *   app.js   → App    (this file — orchestrator)
 *
 * Responsibilities:
 *   • State management (unit, pinned locations, current weather)
 *   • Boot sequence + geolocation
 *   • Fetching & rendering all dashboard sections
 *   • Search with debounce + autocomplete dropdown
 *   • Unit toggle (°C / °F) with localStorage persistence
 *   • Pin / unpin cities with live temperature refresh
 *   • Dynamic background themes + particle spawning
 * ═══════════════════════════════════════════════════════════════
 */

const App = (() => {

  /* ═══════════════════════════════════════════════════════════
     APPLICATION STATE
  ═══════════════════════════════════════════════════════════ */
  const S = {
    location : null,   // { lat, lon, city, country, tz }
    weather  : null,   // Full Open-Meteo forecast response
    aqi      : null,   // Open-Meteo AQI response (or null)
    unit     : localStorage.getItem('sc_unit')  || 'C',
    pinned   : JSON.parse(localStorage.getItem('sc_pins') || '[]'),
    searchTid: null,   // setTimeout ID for search debounce
    dtTid    : null,   // setInterval ID for live clock
  };

  /* ═══════════════════════════════════════════════════════════
     DOM HELPERS
  ═══════════════════════════════════════════════════════════ */
  const $       = id          => document.getElementById(id);
  const mk      = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls)  e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  };

  /** Set element text safely */
  function txt(id, value) {
    const e = $(id);
    if (e) e.textContent = String(value);
  }

  /** Set metric sub-label text + level colour class */
  function sub(id, text, levelClass = '') {
    const e = $(id);
    if (!e) return;
    e.textContent = text;
    e.className   = levelClass ? `mc-sub ${levelClass}` : 'mc-sub';
  }

  /* ═══════════════════════════════════════════════════════════
     QUICK-ACCESS WORLD CITIES BAR
     Edit this array to add/remove cities shown at the top.
  ═══════════════════════════════════════════════════════════ */
  const WORLD_CITIES = [
    { city: 'New York',   country: 'United States',   lat:  40.7128, lon:  -74.0060 },
    { city: 'London',     country: 'United Kingdom',  lat:  51.5074, lon:   -0.1278 },
    { city: 'Tokyo',      country: 'Japan',           lat:  35.6762, lon:  139.6503 },
    { city: 'Sydney',     country: 'Australia',       lat: -33.8688, lon:  151.2093 },
    { city: 'Dubai',      country: 'UAE',             lat:  25.2048, lon:   55.2708 },
    { city: 'Paris',      country: 'France',          lat:  48.8566, lon:    2.3522 },
    { city: 'Mumbai',     country: 'India',           lat:  19.0760, lon:   72.8777 },
    { city: 'Delhi',      country: 'India',           lat:  28.7041, lon:   77.1025 },
    { city: 'Moscow',     country: 'Russia',          lat:  55.7558, lon:   37.6173 },
    { city: 'Cairo',      country: 'Egypt',           lat:  30.0444, lon:   31.2357 },
    { city: 'Singapore',  country: 'Singapore',       lat:   1.3521, lon:  103.8198 },
    { city: 'Kolkata',    country: 'India',           lat:  22.5726, lon:   88.3639 },
    { city: 'Bangalore',  country: 'India',           lat:  12.9716, lon:   77.5946 },
  ];

  function buildQuickCities() {
    const wrap = $('quickBtns');
    WORLD_CITIES.forEach(q => {
      const b = mk('button', 'qc-btn', q.city);
      b.addEventListener('click', () =>
        loadWeather(q.lat, q.lon, q.city, q.country));
      wrap.appendChild(b);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     BACKGROUND THEME & PARTICLE SYSTEM
  ═══════════════════════════════════════════════════════════ */

  /**
   * applyTheme
   * Updates <body> class to switch CSS variable set,
   * then spawns matching weather particles.
   *
   * @param {string}  theme  — 'sunny'|'cloudy'|'rainy'|'snowy'|'stormy'|'foggy'|'night'
   * @param {boolean} isDay
   */
  function applyTheme(theme, isDay) {
    // Remove all previous theme classes cleanly
    document.body.className = document.body.className
      .replace(/\btheme-\S+/g, '')
      .trim();

    document.body.classList.add(`theme-${theme}`);

    // Additionally add night for night-mode colour shift
    if (!isDay && theme !== 'night') {
      document.body.classList.add('theme-night');
    }

    spawnParticles(theme);
  }

  /**
   * spawnParticles
   * Clears existing particles and creates new ones
   * matching the current weather condition.
   */
  function spawnParticles(theme) {
    const wrap = $('particles');
    wrap.innerHTML = '';   // clear old particles

    if (theme === 'rainy' || theme === 'stormy') {
      // ── Rain drops ──
      for (let i = 0; i < 90; i++) {
        const d = mk('div', 'rain-drop');
        d.style.left              = `${Math.random() * 100}%`;
        d.style.animationDuration = `${0.45 + Math.random() * 0.95}s`;
        d.style.animationDelay    = `${Math.random() * 2.5}s`;
        d.style.opacity           = 0.20 + Math.random() * 0.50;
        // Vary drop length for depth illusion
        d.style.height            = `${14 + Math.random() * 10}px`;
        wrap.appendChild(d);
      }

    } else if (theme === 'snowy') {
      // ── Snow flakes ──
      for (let i = 0; i < 55; i++) {
        const s  = mk('div', 'snow-flake');
        const sz = 3 + Math.random() * 5;
        s.style.left              = `${Math.random() * 100}%`;
        s.style.width             = `${sz}px`;
        s.style.height            = `${sz}px`;
        s.style.animationDuration = `${3 + Math.random() * 5}s`;
        s.style.animationDelay    = `${Math.random() * 6}s`;
        s.style.opacity           = 0.50 + Math.random() * 0.40;
        wrap.appendChild(s);
      }

    } else if (theme === 'sunny') {
      // ── Sun motes (floating light particles) ──
      for (let i = 0; i < 22; i++) {
        const m = mk('div', 'sun-mote');
        m.style.left              = `${Math.random() * 100}%`;
        m.style.top               = `${Math.random() * 100}%`;
        m.style.animationDuration = `${3 + Math.random() * 4}s`;
        m.style.animationDelay    = `${Math.random() * 4}s`;
        wrap.appendChild(m);
      }
    }
    // cloudy / foggy / night → no particles (minimal, atmospheric look)
  }

  /* ═══════════════════════════════════════════════════════════
     SCREEN STATE MANAGEMENT
  ═══════════════════════════════════════════════════════════ */

  function showLoading() {
    $('loadingScreen').classList.remove('hidden');
    $('errorScreen'  ).classList.add('hidden');
    $('dashboard'    ).classList.add('hidden');
  }

  function showError(msg) {
    $('loadingScreen').classList.add('hidden');
    $('errorScreen'  ).classList.remove('hidden');
    $('dashboard'    ).classList.add('hidden');
    txt('errMsg', msg || 'Failed to load weather data.');
  }

  function showDashboard() {
    $('loadingScreen').classList.add('hidden');
    $('errorScreen'  ).classList.add('hidden');

    const dash = $('dashboard');
    dash.classList.remove('hidden');

    // Force animation replay on each weather load
    dash.style.animation = 'none';
    void dash.offsetHeight;         // trigger reflow
    dash.style.animation = '';      // restore CSS animation
  }

  /* ═══════════════════════════════════════════════════════════
     LOAD WEATHER  — the main data-fetch orchestrator
  ═══════════════════════════════════════════════════════════ */

  /**
   * loadWeather
   * Fetches weather + AQI in parallel, then renders.
   * Reverse-geocodes if city name was not provided
   * (happens when using browser geolocation).
   *
   * @param {number} lat
   * @param {number} lon
   * @param {string} [city]     — Pass null for auto reverse-geocode
   * @param {string} [country]
   */
  async function loadWeather(lat, lon, city, country) {
    showLoading();
    try {
      // Parallel fetch — weather + AQI fire at the same time
      const [weather, aqi] = await Promise.all([
        API.getWeather(lat, lon),
        API.getAQI(lat, lon)
      ]);

      S.weather = weather;
      S.aqi     = aqi;

      // Resolve city name if not provided (geolocation path)
      if (!city) {
        const geo = await API.reverseGeocode(lat, lon);
        city    = geo.city;
        country = geo.country;
      }

      S.location = { lat, lon, city, country, tz: weather.timezone };

      render();
      showDashboard();

    } catch (err) {
      console.error('[App] loadWeather error:', err);
      showError(
        'Could not load weather data. ' +
        'Check your internet connection and try again.'
      );
    }
  }

  /* ═══════════════════════════════════════════════════════════
     RENDER — top-level orchestrator
  ═══════════════════════════════════════════════════════════ */
  function render() {
    renderHero();
    renderMetrics();
    renderHourly();
    renderDaily();
    renderPinned();
  }

  /* ══════════════════════
     RENDER: HERO SECTION
  ══════════════════════ */
  function renderHero() {
    const { weather: wx, unit, location: loc } = S;
    const cur = wx.current;
    const d0  = wx.daily;
    const wi  = Utils.getWeatherInfo(cur.weather_code, cur.is_day);

    // Apply weather theme + particles
    applyTheme(wi.theme, cur.is_day === 1);

    // Location header
    txt('hCity',    loc.city);
    txt('hCountry', loc.country);
    txt('hDt',      Utils.fmtDatetime(loc.tz));

    // Main temperature + condition
    txt('hIcon',  wi.emoji);
    txt('hTemp',  Utils.fmtTemp(cur.temperature_2m, unit));
    txt('hUnit',  unit);
    txt('hCond',  wi.text);
    txt('hFeels', Utils.fmtTemp(cur.apparent_temperature, unit));
    txt('hMax',   Utils.fmtTemp(d0.temperature_2m_max[0], unit));
    txt('hMin',   Utils.fmtTemp(d0.temperature_2m_min[0], unit));

    // Extra metric rows (left panel)
    txt('hHumid',   `${cur.relative_humidity_2m}%`);
    txt('hWind',    `${Math.round(cur.wind_speed_10m)} km/h`);
    txt('hSunrise', Utils.fmtTime(d0.sunrise[0], loc.tz));
    txt('hSunset',  Utils.fmtTime(d0.sunset[0],  loc.tz));

    // Live clock — refresh datetime every 60 s
    clearInterval(S.dtTid);
    S.dtTid = setInterval(
      () => txt('hDt', Utils.fmtDatetime(loc.tz)),
      60_000
    );
  }

  /* ════════════════════════
     RENDER: METRICS GRID
  ════════════════════════ */
  function renderMetrics() {
    const { weather: wx, aqi } = S;
    const cur = wx.current;
    const d0  = wx.daily;

    // ── UV Index (daily max — most accurate) ─────────────────
    const uv  = d0.uv_index_max?.[0] ?? null;
    const uvl = Utils.uvLevel(uv);
    txt('mUV',    uv !== null ? Math.round(uv) : '--');
    sub('mUVlvl', uvl.text, uvl.cls);

    // ── Pressure ─────────────────────────────────────────────
    txt('mPres',      `${Math.round(cur.pressure_msl)} hPa`);
    sub('mPresTrend', Utils.pressureTrend(cur.pressure_msl));

    // ── Visibility (Open-Meteo: metres → km) ─────────────────
    const visKm = (cur.visibility / 1000).toFixed(1);
    txt('mVis',   `${visKm} km`);
    sub('mVisLvl', Utils.visLevel(cur.visibility));

    // ── Air Quality Index ─────────────────────────────────────
    const aqiRaw = S.aqi?.current?.european_aqi;
    const aqil   = Utils.aqiLevel(aqiRaw ?? null);
    txt('mAQI',    aqiRaw !== undefined ? Math.round(aqiRaw) : 'N/A');
    sub('mAQIlvl', aqil.text, aqil.cls);

    // ── Precipitation ─────────────────────────────────────────
    const precip = d0.precipitation_sum?.[0]             ?? 0;
    const prob   = d0.precipitation_probability_max?.[0] ?? 0;
    txt('mPrecip',  `${precip.toFixed(1)} mm`);
    sub('mPrecipP', `Chance: ${prob}%`);

    // ── Cloud cover + animated progress bar ──────────────────
    const cloud = cur.cloud_cover;
    txt('mCloud', `${cloud}%`);
    // Delay to let display:block resolve before animating width
    requestAnimationFrame(() => {
      const b = $('mCloudBar');
      if (b) b.style.width = `${cloud}%`;
    });

    // ── Humidity + animated progress bar ─────────────────────
    const hum = cur.relative_humidity_2m;
    txt('mHum', `${hum}%`);
    requestAnimationFrame(() => {
      const b = $('mHumBar');
      if (b) b.style.width = `${hum}%`;
    });

    // ── Wind ─────────────────────────────────────────────────
    const dir = Utils.windDir(cur.wind_direction_10m);
    txt('mWind',    `${Math.round(cur.wind_speed_10m)} km/h`);
    sub('mWindDir', `${dir} · Gusts ${Math.round(cur.wind_gusts_10m)} km/h`);
  }

  /* ════════════════════════════
     RENDER: HOURLY FORECAST RAIL
  ════════════════════════════ */
  function renderHourly() {
    const { weather: wx, unit } = S;
    const { time, temperature_2m, weather_code,
            precipitation_probability, is_day } = wx.hourly;

    const rail = $('hourlyRail');
    rail.innerHTML = '';

    const startIdx = Utils.nowHourIdx(time, wx.timezone);
    const endIdx   = Math.min(startIdx + 24, time.length);

    for (let i = startIdx; i < endIdx; i++) {
      const wi    = Utils.getWeatherInfo(weather_code[i], is_day?.[i] ?? 1);
      const isNow = i === startIdx;
      const pop   = precipitation_probability?.[i] ?? 0;

      const card  = mk('div', `hr-card${isNow ? ' is-now' : ''}`, `
        <div class="hr-time">${isNow ? 'Now' : Utils.fmtHour(time[i])}</div>
        <div class="hr-icon" aria-hidden="true">${wi.emoji}</div>
        <div class="hr-temp">${Utils.fmtTemp(temperature_2m[i], unit)}°</div>
        <div class="hr-rain" title="Precipitation probability">${pop}%</div>
      `);
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label',
        `${isNow ? 'Now' : Utils.fmtHour(time[i])}: ${wi.text}, ` +
        `${Utils.fmtTemp(temperature_2m[i], unit)}°${unit}`);
      rail.appendChild(card);
    }
  }

  /* ══════════════════════════
     RENDER: 7-DAY DAILY LIST
  ══════════════════════════ */
  function renderDaily() {
    const { weather: wx, unit } = S;
    const d    = wx.daily;
    const list = $('dailyList');
    list.innerHTML = '';

    for (let i = 0; i < d.time.length; i++) {
      const wi   = Utils.getWeatherInfo(d.weather_code[i]);
      const pop  = d.precipitation_probability_max?.[i] ?? 0;
      const tMax = Utils.fmtTemp(d.temperature_2m_max[i], unit);
      const tMin = Utils.fmtTemp(d.temperature_2m_min[i], unit);

      const row = mk('div', `day-row${i === 0 ? ' is-today' : ''}`, `
        <div class="dr-day">${Utils.fmtDate(d.time[i])}</div>
        <div class="dr-icon" aria-hidden="true">${wi.emoji}</div>
        <div class="dr-cond">${wi.text}</div>
        <div class="dr-pop" title="Precipitation probability">💧 ${pop}%</div>
        <div class="dr-temps">
          <span class="dr-max">${tMax}°</span>
          <div class="dr-bar" aria-hidden="true"><div class="dr-fill"></div></div>
          <span class="dr-min">${tMin}°</span>
        </div>
      `);
      row.setAttribute('role', 'listitem');
      row.setAttribute('aria-label',
        `${Utils.fmtDate(d.time[i])}: ${wi.text}, high ${tMax}°, low ${tMin}°`);
      list.appendChild(row);
    }
  }

  /* ════════════════════════════
     RENDER: PINNED LOCATIONS
  ════════════════════════════ */
  function renderPinned() {
    const grid = $('pinnedGrid');
    grid.innerHTML = '';

    if (!S.pinned.length) {
      grid.appendChild(mk('p', 'no-pins',
        'No pinned locations yet — search for a city and click "＋ Pin This City".'));
      return;
    }

    S.pinned.forEach((p, i) => {
      // Show stored celsius value converted to current unit,
      // or placeholder "…" while async refresh is in progress
      const displayTemp = p.tempC !== undefined
        ? `${Utils.fmtTemp(p.tempC, S.unit)}°${S.unit}`
        : '…';

      const card = mk('div', 'pin-card', `
        <div class="pin-hdr">
          <div class="pin-city">${p.city}</div>
          <button class="pin-del" data-i="${i}"
                  title="Remove ${p.city}" aria-label="Remove ${p.city}">×</button>
        </div>
        <div class="pin-country">${p.country}</div>
        <div class="pin-temp">${displayTemp}</div>
        <div class="pin-cond">${p.cond || 'Loading…'}</div>
      `);

      // Click card body → switch to that city
      card.addEventListener('click', e => {
        if (!e.target.classList.contains('pin-del')) {
          loadWeather(p.lat, p.lon, p.city, p.country);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
      grid.appendChild(card);
    });

    // Wire up × remove buttons
    grid.querySelectorAll('.pin-del').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        S.pinned.splice(Number(btn.dataset.i), 1);
        savePinned();
        renderPinned();
      });
    });

    // Async refresh live temperatures for each pinned city
    refreshPinnedTemps();
  }

  /**
   * refreshPinnedTemps
   * Sequentially fetches current conditions for each pinned
   * location and updates the stored tempC + cond strings.
   * Calls renderPinned() after each update so cards fill
   * in as data arrives (progressive enhancement).
   */
  async function refreshPinnedTemps() {
    for (let i = 0; i < S.pinned.length; i++) {
      try {
        const wx = await API.getWeather(S.pinned[i].lat, S.pinned[i].lon);
        const wi = Utils.getWeatherInfo(wx.current.weather_code, wx.current.is_day);
        S.pinned[i].tempC = wx.current.temperature_2m;
        S.pinned[i].cond  = `${wi.emoji} ${wi.text}`;
        savePinned();
        renderPinned();      // partial re-render after each city
      } catch {
        /* silently skip — pinned card shows last cached data */
      }
    }
  }

  function savePinned() {
    localStorage.setItem('sc_pins', JSON.stringify(S.pinned));
  }

  /* ═══════════════════════════════════════════════════════════
     UNIT TOGGLE  (°C / °F)
  ═══════════════════════════════════════════════════════════ */
  function setUnit(u) {
    S.unit = u;
    localStorage.setItem('sc_unit', u);

    document.querySelectorAll('.u-btn').forEach(b => {
      const active = b.dataset.unit === u;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });

    // Re-render immediately if we already have data
    if (S.weather) render();
  }

  /* ═══════════════════════════════════════════════════════════
     SEARCH  — debounced autocomplete
  ═══════════════════════════════════════════════════════════ */
  function initSearch() {
    const inp  = $('searchInput');
    const drop = $('suggestions');

    // Debounced input listener
    inp.addEventListener('input', () => {
      clearTimeout(S.searchTid);
      const q = inp.value.trim();
      if (q.length < 2) { closeDrop(drop); return; }
      // Wait 280 ms after last keystroke before fetching
      S.searchTid = setTimeout(() => populateDrop(q, drop), 280);
    });

    // Keyboard navigation
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const first = drop.querySelector('.sug-item');
        if (first) first.click();
      }
      if (e.key === 'Escape') closeDrop(drop);
    });

    // Close dropdown on any outside click
    document.addEventListener('click', e => {
      if (!e.target.closest('.search-box')) closeDrop(drop);
    });
  }

  function closeDrop(drop) {
    drop.innerHTML = '';
    drop.classList.remove('open');
  }

  async function populateDrop(query, drop) {
    const results = await API.searchCities(query);

    if (!results.length) {
      drop.innerHTML = '<div class="sug-empty">No cities found</div>';
      drop.classList.add('open');
      return;
    }

    drop.innerHTML = results
      .map(r => `
        <div class="sug-item" role="option"
             data-lat="${r.latitude}"  data-lon="${r.longitude}"
             data-city="${r.name}"     data-country="${r.country || ''}">
          <span class="sug-city">${r.name}</span>
          <span class="sug-region">
            ${r.admin1 ? r.admin1 + ', ' : ''}${r.country || ''}
          </span>
        </div>`)
      .join('');
    drop.classList.add('open');

    // Wire click on each suggestion
    drop.querySelectorAll('.sug-item').forEach(item => {
      item.addEventListener('click', () => {
        $('searchInput').value = item.dataset.city;
        closeDrop(drop);
        loadWeather(
          parseFloat(item.dataset.lat),
          parseFloat(item.dataset.lon),
          item.dataset.city,
          item.dataset.country
        );
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     GEOLOCATION
  ═══════════════════════════════════════════════════════════ */
  function initGeo() {
    $('locateBtn').addEventListener('click', () => {
      if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser.');
        return;
      }
      showLoading();
      navigator.geolocation.getCurrentPosition(
        pos => loadWeather(pos.coords.latitude, pos.coords.longitude),
        ()  => {
          // Permission denied or timeout → fallback city
          loadWeather(51.5074, -0.1278, 'London', 'United Kingdom');
        },
        { timeout: 8000, enableHighAccuracy: false }
      );
    });
  }

  /* ═══════════════════════════════════════════════════════════
     PIN CURRENT CITY
  ═══════════════════════════════════════════════════════════ */
  function initPin() {
    $('pinBtn').addEventListener('click', () => {
      if (!S.location) return;

      const loc = S.location;

      // Duplicate check: ~5 km radius (0.05° ≈ 5.5 km)
      const alreadyPinned = S.pinned.some(p =>
        Math.abs(p.lat - loc.lat) < 0.05 &&
        Math.abs(p.lon - loc.lon) < 0.05
      );
      if (alreadyPinned) { flashBtn($('pinBtn'), '✓ Already pinned'); return; }

      // Hard cap at 8 pins
      if (S.pinned.length >= 8) { flashBtn($('pinBtn'), '⚠ Max 8 pins'); return; }

      // Cache current weather values so the card shows data immediately
      const cur = S.weather?.current;
      const wi  = cur ? Utils.getWeatherInfo(cur.weather_code, cur.is_day) : {};

      S.pinned.push({
        lat    : loc.lat,
        lon    : loc.lon,
        city   : loc.city,
        country: loc.country,
        tempC  : cur?.temperature_2m ?? undefined,
        cond   : cur ? `${wi.emoji} ${wi.text}` : ''
      });

      savePinned();
      renderPinned();
      flashBtn($('pinBtn'), '✓ Pinned!');
    });
  }

  function flashBtn(btn, msg) {
    const orig = btn.textContent;
    btn.textContent = msg;
    setTimeout(() => { btn.textContent = orig; }, 2200);
  }

  /* ═══════════════════════════════════════════════════════════
     BOOT  — first load
  ═══════════════════════════════════════════════════════════ */
  function boot() {
    if (navigator.geolocation) {
      showLoading();
      navigator.geolocation.getCurrentPosition(
        pos => loadWeather(pos.coords.latitude, pos.coords.longitude),
        ()  => loadWeather(51.5074, -0.1278, 'London', 'United Kingdom'),
        { timeout: 6000, enableHighAccuracy: false }
      );
    } else {
      // Browser doesn't support geolocation → London as default
      loadWeather(51.5074, -0.1278, 'London', 'United Kingdom');
    }
  }

  /* ═══════════════════════════════════════════════════════════
     INIT  — wire up all event listeners then boot
  ═══════════════════════════════════════════════════════════ */
  function init() {
    // Build quick-access city buttons
    buildQuickCities();

    // Wire search, geolocation, pin
    initSearch();
    initGeo();
    initPin();

    // Retry button on error screen
    $('retryBtn').addEventListener('click', () =>
      S.location
        ? loadWeather(S.location.lat, S.location.lon,
                      S.location.city, S.location.country)
        : boot()
    );

    // Unit toggle — set initial active state + add listeners
    document.querySelectorAll('.u-btn').forEach(b => {
      const active = b.dataset.unit === S.unit;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
      b.addEventListener('click', () => setUnit(b.dataset.unit));
    });

    // Kick off
    boot();
  }

  /* ── Expose only init ── */
  return { init };

})();

/* ─────────────────────────────────────────
   Entry point — wait for full DOM parse
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', App.init);
