import hospitalsData from './hospitalsData.js';

const QUICK_FILTERS = [
  { label: 'Emergency', service: 'er' },
  { label: 'Maternity', service: 'maternity' },
  { label: 'Dentist', service: 'dental' },
  { label: 'Pharmacy', facilityType: 'Pharmacy' },
  { label: 'Rural Clinic', facilityType: 'Clinic', ruralUrban: 'Rural' },
  { label: 'Urban Clinic', facilityType: 'Clinic', ruralUrban: 'Urban' },
  { label: 'Mission Hospital', facilityType: 'Mission Hospital' },
  { label: 'District Hospital', facilityType: 'District Hospital' },
  { label: 'Provincial Hospital', facilityType: 'Provincial Hospital' },
  { label: '24h', open24: true },
];

const state = {
  hospitals: [...hospitalsData],
  filters: {
    search: '',
    province: '',
    ownership: '',
    facilityType: '',
    tier: '',
    service: '',
    ruralUrban: '',
    open24: false,
    sort: 'name',
  },
  view: 'list',
  location: null,
  locationError: '',
  activeQuickFilter: null,
};

let renderQueued = false;
let lastListSignature = '';
let lastMapSignature = '';
let structuredDataInjected = false;
let mapInstance = null;
let mapLayerGroup = null;

const TIER1_SPECIALISTS = ['oncology', 'cardiology', 'neurosurgery', 'icu', 'critical care', 'trauma', 'hematology', 'neonatology'];

const tierHelper = (hospital) => {
  if (hospital.tier) return hospital.tier;
  const bedCount = typeof hospital.bed_count === 'number' ? hospital.bed_count : null;
  const services = (hospital.services || []).map((s) => s.toLowerCase());
  const typeValue = (hospital.facility_type || '').toLowerCase();
  const hasTier1Discipline = services.some((spec) => TIER1_SPECIALISTS.some((key) => spec.includes(key)));
  if (typeValue.includes('central') || typeValue.includes('referral') || bedCount >= 350 || hasTier1Discipline) return 'Tier 1';
  if (typeValue.includes('provincial') || typeValue.includes('district') || (bedCount && bedCount >= 120)) return 'Tier 2';
  return 'Tier 3';
};

const trackEvent = (eventName, payload = {}) => {
  // TODO: Wire to a real analytics provider (GA/Matomo/etc.).
  void eventName;
  void payload;
};

const provinceFilter = document.getElementById('province-filter');
const ownershipFilter = document.getElementById('ownership-filter');
const facilityFilter = document.getElementById('facility-filter');
const tierFilter = document.getElementById('tier-filter');
const serviceFilter = document.getElementById('service-filter');
const ruralFilter = document.getElementById('rural-filter');
const open24Filter = document.getElementById('open24-filter');
const sortSelect = document.getElementById('sort');
const searchInput = document.getElementById('search');
const locationButton = document.getElementById('enable-location');
const locationStatus = document.getElementById('location-status');
const resultsEl = document.getElementById('results');
const resultsSummary = document.getElementById('results-summary');
const template = document.getElementById('hospital-card');
const listViewBtn = document.getElementById('list-view');
const mapViewBtn = document.getElementById('map-view');
const mapPanel = document.getElementById('map-panel');
const mapContainer = document.getElementById('map');
const quickFilterBar = document.getElementById('quick-filters');

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

const formatDate = (value) => {
  if (!value) return 'Verification pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `Verified ${date.toLocaleString('en-GB', { month: 'short', year: 'numeric' })}`;
};

const formatVerification = (hospital) => {
  const base = formatDate(hospital.last_verified);
  return hospital.verified ? `${base} • Verified source` : base;
};

const renderFilters = () => {
  const provinces = new Set();
  const ownerships = new Set();
  const facilities = new Set();
  const tiers = new Set();
  const services = new Set();
  const ruralOptions = new Set();
  state.hospitals.forEach((h) => {
    if (h.province) provinces.add(h.province);
    if (h.ownership) ownerships.add(h.ownership);
    if (h.facility_type) facilities.add(h.facility_type);
    if (tierHelper(h)) tiers.add(tierHelper(h));
    (h.services || []).forEach((s) => services.add(s));
    if (h.rural_urban) ruralOptions.add(h.rural_urban);
  });
  provinceFilter.innerHTML =
    '<option value="">All provinces</option>' +
    Array.from(provinces)
      .sort()
      .map((province) => `<option value="${province}">${province}</option>`)
      .join('');
  ownershipFilter.innerHTML =
    '<option value="">All ownership</option>' +
    Array.from(ownerships)
      .sort()
      .map((owner) => `<option value="${owner}">${owner}</option>`)
      .join('');
  facilityFilter.innerHTML =
    '<option value="">All facilities</option>' +
    Array.from(facilities)
      .sort()
      .map((facility) => `<option value="${facility}">${facility}</option>`)
      .join('');
  tierFilter.innerHTML =
    '<option value="">All tiers</option>' +
    Array.from(tiers)
      .sort()
      .map((tier) => `<option value="${tier}">${tier}</option>`)
      .join('');
  serviceFilter.innerHTML =
    '<option value="">All services</option>' +
    Array.from(services)
      .sort()
      .map((service) => `<option value="${service}">${formatServiceLabel(service)}</option>`)
      .join('');
  ruralFilter.innerHTML =
    '<option value="">Rural & urban</option>' +
    Array.from(ruralOptions)
      .sort()
      .map((value) => `<option value="${value}">${value}</option>`)
      .join('');
};

const formatServiceLabel = (service = '') => {
  const trimmed = service.trim();
  if (!trimmed) return '';
  const normalizeWord = (word) => {
    if (word.length <= 4) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  };

  if (!trimmed.includes(' ') && trimmed.length <= 4) return trimmed.toUpperCase();

  return trimmed
    .split(/\s+/)
    .map((word) => normalizeWord(word))
    .join(' ');
};

const formatServices = (services = []) =>
  services.length ? services.map((service) => formatServiceLabel(service)).join(' • ') : 'Services coming soon';

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

const buildActionLinks = (hospital) => {
  const actions = [];
  const phone = hospital.phone || '';
  const whatsapp = hospital.whatsapp || '';
  const mapsLink =
    typeof hospital.lat === 'number' && typeof hospital.lon === 'number'
      ? `https://www.google.com/maps/search/?api=1&query=${hospital.lat},${hospital.lon}`
      : '';
  if (phone) actions.push(`<a href="tel:${phone}">Call</a>`);
  if (whatsapp) actions.push(`<a href="https://wa.me/${whatsapp.replace(/\D/g, '')}">WhatsApp</a>`);

  const shareText = encodeURIComponent(
    `Name: ${hospital.name}\nType: ${hospital.facility_type}, ${hospital.rural_urban}\nLocation: ${hospital.district}, ${hospital.province}\nServices: ${formatServices(hospital.services)}\nPhone: ${phone || 'N/A'}\nDirections: ${mapsLink || 'Add coordinates to show directions'}`,
  );
  actions.push(`<a href="https://wa.me/?text=${shareText}">Share on WhatsApp</a>`);

  const mailSubject = encodeURIComponent(`Correction for facility ${hospital.id} - ${hospital.name}`);
  const mailBody = encodeURIComponent(
    `Please describe the correction:\n\nFacility ID: ${hospital.id}\nName: ${hospital.name}\nLocation: ${hospital.district}, ${hospital.province}\nPhone: ${phone || 'N/A'}`,
  );
  actions.push(`<a href="mailto:info@hospitals.co.zw?subject=${mailSubject}&body=${mailBody}">Suggest correction</a>`);

  return actions.join(' · ');
};

const renderList = (filtered) => {
  const signature = filtered
    .map((h) => `${h.id || h.name}:${state.filters.sort}:${h.distance ? h.distance.toFixed(1) : ''}`)
    .join('|');
  if (signature === lastListSignature && state.view === 'list') return;
  lastListSignature = signature;

  if (!filtered.length) {
    resultsEl.innerHTML = '<p>No facilities match those filters yet.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();
  filtered.forEach((hospital) => {
    const node = template.content.cloneNode(true);
    const article = node.querySelector('article');
    article.dataset.hospitalId = hospital.id || hospital.name;
    if (hospital.verified) {
      article.classList.add('card--verified');
    }
    node.querySelector('.card__title').textContent = hospital.name;

    const badgesEl = node.querySelector('.card__badges');
    badgesEl.appendChild(buildBadge(tierHelper(hospital), 'badge--tier'));
    if (hospital.ownership) badgesEl.appendChild(buildBadge(hospital.ownership, 'badge--ownership'));
    if (hospital.rural_urban) badgesEl.appendChild(buildBadge(hospital.rural_urban, ''));

    const distanceLabel =
      state.location && hospital.distance !== null ? ` · ${hospital.distance.toFixed(1)} km away` : '';
    node.querySelector('.card__meta').textContent =
      `${hospital.facility_type || 'Health facility'} · ${hospital.district}, ${hospital.province}${distanceLabel}`;

    node.querySelector('.card__services').textContent = formatServices(hospital.services);
    const flags = [hospital.cost_band, (hospital.medical_aids || []).join(', ')].filter(Boolean).join(' · ');
    node.querySelector('.card__flags').textContent = flags || 'Payments and medical aid: ask at reception';

    node.querySelector('.card__contact').textContent = hospital.phone ? `Phone: ${hospital.phone}` : 'Phone: N/A';
    node.querySelector('.card__hours').textContent = hospital.open_24h ? 'Open 24 hours' : 'Check operating hours with facility';
    node.querySelector('.card__verified').textContent = formatVerification(hospital);
    node.querySelector('.card__actions').innerHTML = buildActionLinks(hospital);

    const details = [
      hospital.address ? `Address: ${hospital.address}` : '',
      hospital.website ? `Website: <a href="${hospital.website}" target="_blank" rel="noopener">${hospital.website}</a>` : '',
      hospital.emergency_level ? `Emergency level: ${hospital.emergency_level}` : '',
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
    document.head.appendChild(css);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error('Map unavailable right now.'));
    document.body.appendChild(script);
  });
};

const renderMap = async (filtered) => {
  const coords = filtered.filter(
    (h) => typeof h.lat === 'number' && !Number.isNaN(h.lat) && typeof h.lon === 'number' && !Number.isNaN(h.lon),
  );

  const signature = coords.map((h) => `${h.id || h.name}:${h.lat},${h.lon}`).join('|');
  if (signature === lastMapSignature && mapInstance) return;
  lastMapSignature = signature;

  const hint = document.querySelector('.map-hint');
  if (!coords.length) {
    if (mapLayerGroup) mapLayerGroup.clearLayers();
    if (hint) hint.textContent = 'Add coordinates to show facilities on the map.';
    return;
  }
  if (hint) {
    hint.textContent = 'Click a marker to highlight the matching card in the list.';
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
    const marker = L.marker([hospital.lat, hospital.lon]).addTo(mapLayerGroup);
    marker.bindPopup(
      `<strong>${hospital.name}</strong><br/>${hospital.district}, ${hospital.province}<br/>${tierHelper(hospital)}`,
    );
    marker.on('click', () => highlightCard(hospital.id || hospital.name));
  });

  const bounds = L.latLngBounds(coords.map((h) => [h.lat, h.lon]));
  mapInstance.fitBounds(bounds, { padding: [16, 16] });
  setTimeout(() => mapInstance.invalidateSize(), 50);
};

const renderHospitals = () => {
  if (!state.hospitals.length) {
    resultsEl.innerHTML = '<p>Loading facilities…</p>';
    return;
  }

  const enriched = state.hospitals.map((hospital) => ({
    ...hospital,
    tier: tierHelper(hospital),
    distance:
      state.location && typeof hospital.lat === 'number' && typeof hospital.lon === 'number'
        ? haversineDistance(state.location.lat, state.location.lon, hospital.lat, hospital.lon)
        : null,
  }));

  const filtered = enriched
    .filter((hospital) => {
      const { search, province, ownership, facilityType, tier, service, ruralUrban, open24 } = state.filters;
      const matchesSearch = search
        ? `${hospital.name} ${hospital.city || ''} ${hospital.district || ''}`.toLowerCase().includes(search.toLowerCase())
        : true;
      const matchesProvince = province ? hospital.province === province : true;
      const matchesOwnership = ownership ? hospital.ownership === ownership : true;
      const matchesFacility = facilityType ? hospital.facility_type === facilityType : true;
      const matchesTier = tier ? hospital.tier === tier : true;
      const matchesService = service
        ? (hospital.services || []).some((spec) => spec.toLowerCase().includes(service.toLowerCase()))
        : true;
      const matchesRural = ruralUrban ? hospital.rural_urban === ruralUrban : true;
      const matchesOpen = open24 ? !!hospital.open_24h : true;
      return (
        matchesSearch &&
        matchesProvince &&
        matchesOwnership &&
        matchesFacility &&
        matchesTier &&
        matchesService &&
        matchesRural &&
        matchesOpen
      );
    })
    .sort((a, b) => {
      if (state.filters.sort === 'nearest') {
        if (!state.location) return a.name.localeCompare(b.name);
        return (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY);
      }
      if (state.filters.sort === 'bed_desc') return (b.bed_count || 0) - (a.bed_count || 0);
      return a.name.localeCompare(b.name);
    });

  if (resultsSummary) {
    const verifiedCount = filtered.filter((h) => h.verified).length;
    resultsSummary.textContent = `${filtered.length} facilities • ${verifiedCount} verified`;
  }

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

const injectStructuredData = (hospitals) => {
  const graph = hospitals.slice(0, 80).map((hospital) => {
    const address = {
      '@type': 'PostalAddress',
      streetAddress: hospital.address || '',
      addressLocality: hospital.district || hospital.city || '',
      addressRegion: hospital.province || '',
      addressCountry: 'Zimbabwe',
    };
    const geo =
      typeof hospital.lat === 'number' && typeof hospital.lon === 'number'
        ? { '@type': 'GeoCoordinates', latitude: hospital.lat, longitude: hospital.lon }
        : undefined;

    return {
      '@type': hospital.facility_type && hospital.facility_type.toLowerCase().includes('clinic') ? 'MedicalClinic' : 'Hospital',
      name: hospital.name,
      telephone: hospital.phone || undefined,
      url: hospital.website || window.location.href,
      address,
      geo,
      medicalSpecialty: hospital.services,
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

const applyQuickFilter = (config, index = null) => {
  state.filters.facilityType = config.facilityType || '';
  state.filters.service = config.service || '';
  state.filters.ruralUrban = config.ruralUrban || '';
  state.filters.open24 = Boolean(config.open24);
  state.activeQuickFilter = typeof index === 'number' ? index : null;
  if (config.facilityType || config.ruralUrban || config.service || config.open24) {
    trackEvent('quick_filter', config);
  }
  facilityFilter.value = state.filters.facilityType;
  serviceFilter.value = state.filters.service;
  ruralFilter.value = state.filters.ruralUrban;
  open24Filter.checked = state.filters.open24;
  updateQuickFilterUI();
  scheduleRender();
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
    state.activeQuickFilter = null;
    updateQuickFilterUI();
    trackEvent('filter_change', { [key]: value });
    scheduleRender();
  };

  provinceFilter.addEventListener('change', (event) => onFilterChange('province', event.target.value));
  ownershipFilter.addEventListener('change', (event) => onFilterChange('ownership', event.target.value));
  facilityFilter.addEventListener('change', (event) => onFilterChange('facilityType', event.target.value));
  tierFilter.addEventListener('change', (event) => onFilterChange('tier', event.target.value));
  serviceFilter.addEventListener('change', (event) => onFilterChange('service', event.target.value));
  ruralFilter.addEventListener('change', (event) => onFilterChange('ruralUrban', event.target.value));
  open24Filter.addEventListener('change', (event) => onFilterChange('open24', event.target.checked));
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

  quickFilterBar?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-quick-index]');
    if (!button) return;
    const index = Number(button.dataset.quickIndex);
    const config = QUICK_FILTERS[index];
    applyQuickFilter(config, index);
  });

  updateLocationUI();
};

const renderQuickFilters = () => {
  if (!quickFilterBar) return;
  quickFilterBar.innerHTML = QUICK_FILTERS.map(
    (filter, index) => `<button type="button" data-quick-index="${index}" class="quick-button">${filter.label}</button>`,
  ).join('');
  updateQuickFilterUI();
};

const updateQuickFilterUI = () => {
  if (!quickFilterBar) return;
  const buttons = quickFilterBar.querySelectorAll('button[data-quick-index]');
  buttons.forEach((btn) => {
    const isActive = state.activeQuickFilter === Number(btn.dataset.quickIndex);
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
};

const init = () => {
  renderFilters();
  renderQuickFilters();
  renderHospitals();
  if (!structuredDataInjected) {
    injectStructuredData(state.hospitals);
  }
};

attachListeners();
init();
