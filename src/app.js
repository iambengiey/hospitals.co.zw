const EMBEDDED_HOSPITALS = window.EMBEDDED_HOSPITALS || [];

const DATA_SOURCES = (() => {
  const REPO_OWNER = 'iambengiey';
  const REPO_NAME = 'hospitals.co.zw';
  const sources = ['data/hospitals.json', './data/hospitals.json', '../data/hospitals.json'];

  sources.push(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/data/hospitals.json`);
  sources.push(`https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@main/data/hospitals.json`);

  const hostParts = window.location.hostname.split('.');
  const owner = window.location.hostname.endsWith('github.io') ? hostParts[0] : null;
  if (owner && owner !== REPO_OWNER) {
    sources.push(`https://raw.githubusercontent.com/${owner}/${REPO_NAME}/main/data/hospitals.json`);
    sources.push(`https://cdn.jsdelivr.net/gh/${owner}/${REPO_NAME}@main/data/hospitals.json`);
  }

  return sources;
})();

const TIER1_SPECIALISTS = [
  'oncology',
  'cardiology',
  'neurosurgery',
  'icu',
  'critical care',
  'trauma',
  'hematology',
  'neonatology',
];

const state = {
  hospitals: [...EMBEDDED_HOSPITALS],
  usedFallback: true,
  filters: {
    search: '',
    province: '',
    type: '',
    category: '',
    tier: '',
    specialist: '',
    sort: 'name',
  },
  view: 'list',
  location: null,
  locationError: '',
};

let renderQueued = false;
let lastListSignature = '';
let lastMapSignature = '';
let structuredDataInjected = false;
let mapInstance = null;
let mapLayerGroup = null;

const tierHelper = (hospital) => {
  const bedCount = typeof hospital.bed_count === 'number' ? hospital.bed_count : null;
  const descriptor = (hospital.specialists || []).map((spec) => spec.toLowerCase());
  const typeValue = (hospital.type || '').toLowerCase();
  const categoryValue = (hospital.category || '').toLowerCase();
  const hasTier1Discipline = descriptor.some((spec) => TIER1_SPECIALISTS.some((key) => spec.includes(key)));
  const hasMultipleSpecialists = descriptor.length >= 2;

  const isCentral =
    typeValue.includes('central') ||
    typeValue.includes('referral') ||
    typeValue.includes('teaching') ||
    typeValue.includes('university') ||
    categoryValue.includes('central');
  if (isCentral || (bedCount !== null && bedCount >= 350) || hasTier1Discipline) {
    return 'T1';
  }

  const isProvincialOrDistrict =
    typeValue.includes('provincial') || typeValue.includes('general') || typeValue.includes('district');
  if ((bedCount !== null && bedCount >= 120) || isProvincialOrDistrict || hasMultipleSpecialists) {
    return 'T2';
  }

  return 'T3';
};

const trackEvent = (eventName, payload = {}) => {
  // TODO: Wire this function to a real analytics provider (Google Analytics, Matomo, etc.).
  // Keep one integration point so telemetry stays consistent.
  if (window?.console) {
    console.debug('[trackEvent]', eventName, payload);
  }
};

const provinceFilter = document.getElementById('province-filter');
const typeFilter = document.getElementById('type-filter');
const categoryFilter = document.getElementById('category-filter');
const tierFilter = document.getElementById('tier-filter');
const specialistFilter = document.getElementById('specialist-filter');
const sortSelect = document.getElementById('sort');
const searchInput = document.getElementById('search');
const locationButton = document.getElementById('enable-location');
const locationStatus = document.getElementById('location-status');
const resultsEl = document.getElementById('results');
const fallbackEl = document.getElementById('data-fallback');
const template = document.getElementById('hospital-card');
const listViewBtn = document.getElementById('list-view');
const mapViewBtn = document.getElementById('map-view');
const mapPanel = document.getElementById('map-panel');
const mapContainer = document.getElementById('map');

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const renderFilters = () => {
  const provinces = new Set();
  const types = new Set();
  const categories = new Set();
  const specialists = new Set();
  state.hospitals.forEach((h) => {
    if (h.province) provinces.add(h.province);
    if (h.type) types.add(h.type);
    if (h.category) categories.add(h.category);
    (h.specialists || []).forEach((spec) => specialists.add(spec));
  });
  provinceFilter.innerHTML =
    '<option value="">All provinces</option>' +
    Array.from(provinces)
      .sort()
      .map((province) => `<option value="${province}">${province}</option>`)
      .join('');
  typeFilter.innerHTML =
    '<option value="">All types</option>' +
    Array.from(types)
      .sort()
      .map((type) => `<option value="${type}">${type}</option>`)
      .join('');
  categoryFilter.innerHTML =
    '<option value="">All facilities</option>' +
    Array.from(categories)
      .sort()
      .map((category) => `<option value="${category}">${category}</option>`)
      .join('');
  specialistFilter.innerHTML =
    '<option value="">All specialists</option>' +
    Array.from(specialists)
      .sort()
      .map((spec) => `<option value="${spec}">${spec}</option>`)
      .join('');
};

const formatSpecialists = (specialists = []) => (specialists.length ? specialists.join(', ') : 'Specialists TBD');

const highlightCard = (id) => {
  if (!id) return;
  const target = document.querySelector(`[data-hospital-id="${CSS.escape(id)}"]`);
  if (target) {
    target.classList.add('is-highlighted');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => target.classList.remove('is-highlighted'), 1200);
  }
};

const buildBadge = (label, className) => {
  const badge = document.createElement('span');
  badge.className = `badge ${className}`;
  badge.textContent = label;
  return badge;
};

const renderList = (filtered) => {
  const signature = filtered
    .map((h) => `${h.id || h.name}:${state.filters.sort}:${h.distance ? h.distance.toFixed(1) : ''}`)
    .join('|');
  if (signature === lastListSignature && state.view === 'list') return;
  lastListSignature = signature;

  if (!filtered.length) {
    resultsEl.innerHTML = '<p>No hospitals match your filters yet.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();
  filtered.forEach((hospital) => {
    const node = template.content.cloneNode(true);
    const article = node.querySelector('article');
    article.dataset.hospitalId = hospital.id || hospital.name;
    node.querySelector('.card__title').textContent = hospital.name;

    const badgesEl = node.querySelector('.card__badges');
    badgesEl.appendChild(buildBadge(`Tier ${hospital.tier}`, 'badge--tier'));
    if (hospital.ownership) {
      badgesEl.appendChild(buildBadge(hospital.ownership, 'badge--ownership'));
    }
    if (hospital.category) {
      badgesEl.appendChild(buildBadge(hospital.category, ''));
    }

    const facilityLabel = hospital.category ? hospital.category : 'hospital';
    const distanceLabel = state.location && hospital.distance !== null ? ` • ${hospital.distance.toFixed(1)} km away` : '';
    node.querySelector('.card__meta').textContent = `${hospital.city}, ${hospital.province} • ${facilityLabel}${distanceLabel}`;
    node.querySelector('.card__address').textContent = hospital.address || 'Address coming soon';
    node.querySelector('.card__specialists').textContent = `Specialists: ${formatSpecialists(hospital.specialists)}`;
    node.querySelector('.card__contact').textContent = `Phone: ${hospital.phone || 'N/A'}`;
    node.querySelector('.card__hours').textContent = `Hours: ${hospital.operating_hours || 'See facility for details'}`;

    const details = [
      `Facility: ${hospital.category || 'hospital'}`,
      `Type: ${hospital.type || 'Unknown'}${hospital.ownership ? ` (${hospital.ownership})` : ''}`,
      `Beds: ${hospital.bed_count ?? 'Unknown'}`,
      hospital.manager ? `Manager: ${hospital.manager}` : '',
      hospital.website ? `Website: <a href="${hospital.website}" target="_blank" rel="noopener">${hospital.website}</a>` : '',
      state.location && hospital.distance !== null ? `Distance from you: ${hospital.distance.toFixed(1)} km` : '',
      `Last verified: ${hospital.last_verified || 'TBD'}`,
    ]
      .filter(Boolean)
      .map((line) => `<p>${line}</p>`)
      .join('');

    const detailsEl = node.querySelector('.card__details');
    detailsEl.innerHTML = details;

    const toggleBtn = node.querySelector('.card__toggle');
    toggleBtn.addEventListener('click', (event) => {
      const expanded = !detailsEl.hasAttribute('hidden');
      if (expanded) {
        detailsEl.setAttribute('hidden', '');
        event.currentTarget.textContent = 'More details';
        event.currentTarget.setAttribute('aria-expanded', 'false');
      } else {
        detailsEl.removeAttribute('hidden');
        event.currentTarget.textContent = 'Hide details';
        event.currentTarget.setAttribute('aria-expanded', 'true');
        trackEvent('card_expand', { id: hospital.id || hospital.name, name: hospital.name });
      }
    });

    article.addEventListener('click', () => {
      trackEvent('card_click', { id: hospital.id || hospital.name, name: hospital.name });
    });

    fragment.appendChild(node);
  });

  resultsEl.innerHTML = '';
  resultsEl.appendChild(fragment);
};

const loadLeaflet = () => {
  if (window.L) return Promise.resolve(window.L);
  return new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    css.onload = () => {};
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error('Failed to load map library'));
    document.body.appendChild(script);
  });
};

const renderMap = async (filtered) => {
  const coords = filtered.filter(
    (h) => typeof h.latitude === 'number' && !Number.isNaN(h.latitude) && typeof h.longitude === 'number' && !Number.isNaN(h.longitude),
  );

  const signature = coords.map((h) => `${h.id || h.name}:${h.latitude},${h.longitude}`).join('|');
  if (signature === lastMapSignature && mapInstance) return;
  lastMapSignature = signature;

  const hint = document.querySelector('.map-hint');
  if (!coords.length) {
    if (mapLayerGroup) {
      mapLayerGroup.clearLayers();
    }
    if (hint) {
      hint.textContent = 'Add latitude/longitude to show facilities on the map.';
    }
    return;
  }
  if (hint) {
    hint.textContent = 'Map shows facilities with coordinates. Click a marker to highlight the matching card in the list.';
  }

  const L = await loadLeaflet();
  if (!mapInstance) {
    mapInstance = L.map('map', { zoomControl: true }).setView([-18.1, 30.0], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapInstance);
    mapLayerGroup = L.layerGroup().addTo(mapInstance);
  }

  mapLayerGroup.clearLayers();
  coords.forEach((hospital) => {
    const marker = L.marker([hospital.latitude, hospital.longitude]).addTo(mapLayerGroup);
    marker.bindPopup(
      `<strong>${hospital.name}</strong><br/>${hospital.city}, ${hospital.province}<br/>Tier ${hospital.tier}`,
    );
    marker.on('click', () => highlightCard(hospital.id || hospital.name));
  });

  const bounds = L.latLngBounds(coords.map((h) => [h.latitude, h.longitude]));
  mapInstance.fitBounds(bounds, { padding: [16, 16] });
  setTimeout(() => mapInstance.invalidateSize(), 50);
};

const renderHospitals = () => {
  if (!state.hospitals.length) {
    resultsEl.innerHTML = '<p>Loading hospitals...</p>';
    return;
  }

  const enriched = state.hospitals.map((hospital) => ({
    ...hospital,
    tier: tierHelper(hospital),
    distance:
      state.location && typeof hospital.latitude === 'number' && typeof hospital.longitude === 'number'
        ? haversineDistance(state.location.lat, state.location.lon, hospital.latitude, hospital.longitude)
        : null,
  }));

  const filtered = enriched
    .filter((hospital) => {
      const { search, province, type, category, tier, specialist } = state.filters;
      const matchesSearch = search
        ? `${hospital.name} ${hospital.city}`.toLowerCase().includes(search.toLowerCase())
        : true;
      const matchesProvince = province ? hospital.province === province : true;
      const matchesType = type ? hospital.type === type : true;
      const matchesCategory = category ? hospital.category === category : true;
      const matchesTier = tier ? hospital.tier === tier : true;
      const matchesSpecialist = specialist
        ? (hospital.specialists || []).some((spec) => spec.toLowerCase().includes(specialist.toLowerCase()))
        : true;
      return matchesSearch && matchesProvince && matchesType && matchesCategory && matchesTier && matchesSpecialist;
    })
    .sort((a, b) => {
      if (state.filters.sort === 'nearest') {
        if (!state.location) {
          return a.name.localeCompare(b.name);
        }
        return (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY);
      }
      if (state.filters.sort === 'bed_desc') {
        return (b.bed_count || 0) - (a.bed_count || 0);
      }
      return a.name.localeCompare(b.name);
    });

  if (state.view === 'map') {
    resultsEl.hidden = true;
    mapPanel.hidden = false;
    renderMap(filtered).catch((error) => {
      mapContainer.innerHTML = `<p class="map-hint">${error.message}</p>`;
      console.error(error);
    });
    return;
  }

  resultsEl.hidden = false;
  mapPanel.hidden = true;
  renderList(filtered);
};

const updateLocationUI = () => {
  const nearestOption = sortSelect?.querySelector('option[value="nearest"]');
  if (!nearestOption || !locationStatus) return;

  if (state.location) {
    nearestOption.disabled = false;
    locationStatus.textContent =
      state.filters.sort === 'nearest'
        ? 'Location on — sorting by nearest'
        : 'Location on — switch sort to "Nearest to me" to use distance';
    locationStatus.classList.remove('error');
    return;
  }

  nearestOption.disabled = true;
  if (state.filters.sort === 'nearest') {
    state.filters.sort = 'name';
    sortSelect.value = 'name';
  }
  if (state.locationError) {
    locationStatus.textContent = state.locationError;
    locationStatus.classList.add('error');
  } else {
    locationStatus.textContent = 'Location off';
    locationStatus.classList.remove('error');
  }
};

const toggleFallbackNotice = (usedFallback, lastError) => {
  if (!fallbackEl) return;
  if (usedFallback) {
    fallbackEl.removeAttribute('hidden');
    fallbackEl.dataset.error = lastError?.message || '';
  } else {
    fallbackEl.setAttribute('hidden', '');
    delete fallbackEl.dataset.error;
  }
};

const injectStructuredData = (hospitals) => {
  const graph = hospitals.slice(0, 80).map((hospital) => {
    const address = {
      '@type': 'PostalAddress',
      streetAddress: hospital.address || '',
      addressLocality: hospital.city || '',
      addressRegion: hospital.province || '',
      addressCountry: 'Zimbabwe',
    };
    const geo =
      typeof hospital.latitude === 'number' && typeof hospital.longitude === 'number'
        ? { '@type': 'GeoCoordinates', latitude: hospital.latitude, longitude: hospital.longitude }
        : undefined;

    return {
      '@type': 'Hospital',
      name: hospital.name,
      telephone: hospital.phone || undefined,
      url: hospital.website || window.location.href,
      address,
      geo,
      medicalSpecialty: hospital.specialists,
    };
  });

  let script = document.getElementById('structured-data');
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'structured-data';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
  structuredDataInjected = true;
};

const scheduleRender = () => {
  if (renderQueued) return;
  renderQueued = true;
  window.requestAnimationFrame(() => {
    renderQueued = false;
    renderHospitals();
  });
};

const attachListeners = () => {
  const onFilterChange = (key, value) => {
    state.filters[key] = value;
    trackEvent('filter_change', { [key]: value });
    scheduleRender();
  };

  provinceFilter.addEventListener('change', (event) => onFilterChange('province', event.target.value));
  typeFilter.addEventListener('change', (event) => onFilterChange('type', event.target.value));
  categoryFilter.addEventListener('change', (event) => onFilterChange('category', event.target.value));
  specialistFilter.addEventListener('change', (event) => onFilterChange('specialist', event.target.value));
  tierFilter.addEventListener('change', (event) => onFilterChange('tier', event.target.value));
  sortSelect.addEventListener('change', (event) => {
    onFilterChange('sort', event.target.value);
    updateLocationUI();
  });

  let searchDebounce;
  searchInput.addEventListener('input', (event) => {
    const value = event.target.value.trim();
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.filters.search = value;
      trackEvent('search', { query: value });
      scheduleRender();
    }, 120);
  });

  locationButton?.addEventListener('click', () => {
    if (!navigator.geolocation) {
      state.locationError = 'Geolocation not supported in this browser';
      state.location = null;
      updateLocationUI();
      return;
    }

    locationStatus.textContent = 'Requesting location…';
    navigator.geolocation.getCurrentPosition(
      (position) => {
        state.location = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        state.locationError = '';
        state.filters.sort = 'nearest';
        sortSelect.value = 'nearest';
        updateLocationUI();
        scheduleRender();
      },
      (error) => {
        state.location = null;
        state.locationError = error.message || 'Unable to retrieve location';
        updateLocationUI();
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });

  listViewBtn.addEventListener('click', () => {
    state.view = 'list';
    listViewBtn.setAttribute('aria-pressed', 'true');
    mapViewBtn.setAttribute('aria-pressed', 'false');
    trackEvent('view_change', { view: 'list' });
    scheduleRender();
  });

  mapViewBtn.addEventListener('click', () => {
    state.view = 'map';
    listViewBtn.setAttribute('aria-pressed', 'false');
    mapViewBtn.setAttribute('aria-pressed', 'true');
    trackEvent('view_change', { view: 'map' });
    scheduleRender();
  });

  updateLocationUI();
};

const loadHospitals = async () => {
  let lastError = null;
  for (const url of DATA_SOURCES) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return { data, fromFallback: false, lastError: null };
    } catch (error) {
      lastError = error;
    }
  }
  console.warn('Falling back to embedded hospital catalogue', lastError);
  return { data: EMBEDDED_HOSPITALS, fromFallback: true, lastError };
};

const init = async () => {
  renderFilters();
  renderHospitals();
  toggleFallbackNotice(true, null);

  try {
    const { data, fromFallback, lastError } = await loadHospitals();
    if (!data?.length) return;
    state.hospitals = data;
    state.usedFallback = fromFallback;
    toggleFallbackNotice(fromFallback, lastError);
    renderFilters();
    scheduleRender();
    if (!structuredDataInjected) {
      injectStructuredData(state.hospitals);
    }
  } catch (error) {
    resultsEl.innerHTML = `<p class="error">${error.message}. Please try again later.</p>`;
    console.error(error);
  }
};

attachListeners();
init();
