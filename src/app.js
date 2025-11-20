const DATA_URL = 'data/hospitals.json';

const state = {
  hospitals: [],
  filters: {
    search: '',
    province: '',
    type: '',
    category: '',
    tier: '',
    specialist: '',
    sort: 'name',
  },
  location: {
    coords: null,
    status: 'idle',
  },
};

const tierHelper = (hospital) => {
  const bedCount = typeof hospital.bed_count === 'number' ? hospital.bed_count : null;
  const descriptor = (hospital.specialists || []).join(' ').toLowerCase();
  if (
    (hospital.type && hospital.type.toLowerCase().includes('referral')) ||
    descriptor.includes('teaching') ||
    (bedCount !== null && bedCount >= 300)
  ) {
    return 'T1';
  }
  if (bedCount !== null && bedCount >= 100) {
    return 'T2';
  }
  return 'T3';
};

const searchInput = document.getElementById('search');
const provinceFilter = document.getElementById('province-filter');
const typeFilter = document.getElementById('type-filter');
const categoryFilter = document.getElementById('category-filter');
const tierFilter = document.getElementById('tier-filter');
const specialistFilter = document.getElementById('specialist-filter');
const sortSelect = document.getElementById('sort');
const resultsEl = document.getElementById('results');
const template = document.getElementById('hospital-card');
const locationButton = document.getElementById('location-button');
const locationStatus = document.getElementById('location-status');

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
  provinceFilter.innerHTML = '<option value="">All provinces</option>' +
    Array.from(provinces)
      .sort()
      .map((province) => `<option value="${province}">${province}</option>`)
      .join('');
  typeFilter.innerHTML = '<option value="">All types</option>' +
    Array.from(types)
      .sort()
      .map((type) => `<option value="${type}">${type}</option>`)
      .join('');
  categoryFilter.innerHTML = '<option value="">All facilities</option>' +
    Array.from(categories)
      .sort()
      .map((category) => `<option value="${category}">${category}</option>`)
      .join('');
  specialistFilter.innerHTML = '<option value="">All specialists</option>' +
    Array.from(specialists)
      .sort()
      .map((spec) => `<option value="${spec}">${spec}</option>`)
      .join('');
};

const formatSpecialists = (specialists = []) => (specialists.length ? specialists.join(', ') : 'Specialists TBD');

const haversineDistanceKm = (from, to) => {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lon - from.lon);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

const renderHospitals = () => {
  if (!state.hospitals.length) {
    resultsEl.innerHTML = '<p>Loading hospitals...</p>';
    return;
  }

  const filtered = state.hospitals
    .map((hospital) => {
      const tier = tierHelper(hospital);
      const hasCoords = typeof hospital.latitude === 'number' && typeof hospital.longitude === 'number';
      const distance = state.location.coords && hasCoords
        ? haversineDistanceKm(state.location.coords, { lat: hospital.latitude, lon: hospital.longitude })
        : null;
      return { ...hospital, tier, distance };
    })
    .filter((hospital) => {
      const { search, province, type, category, tier, specialist } = state.filters;
      const matchesSearch = search
        ? [hospital.name, hospital.city, ...(hospital.specialists || [])]
            .join(' ')
            .toLowerCase()
            .includes(search.toLowerCase())
        : true;
      const matchesProvince = province ? hospital.province === province : true;
      const matchesType = type ? hospital.type === type : true;
      const matchesCategory = category ? hospital.category === category : true;
      const matchesTier = tier ? hospital.tier === tier : true;
      const matchesSpecialist = specialist
        ? (hospital.specialists || []).some((spec) => spec.toLowerCase() === specialist.toLowerCase())
        : true;
      return matchesSearch && matchesProvince && matchesType && matchesCategory && matchesTier && matchesSpecialist;
    })
    .sort((a, b) => {
      if (state.filters.sort === 'bed_desc') {
        return (b.bed_count || 0) - (a.bed_count || 0);
      }
      if (state.filters.sort === 'nearest') {
        if (a.distance === null && b.distance === null) return a.name.localeCompare(b.name);
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      }
      return a.name.localeCompare(b.name);
    });

  if (!filtered.length) {
    resultsEl.innerHTML = '<p>No hospitals match your filters yet.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();
  filtered.forEach((hospital) => {
    const node = template.content.cloneNode(true);
    node.querySelector('.card__title').textContent = hospital.name;
    const distanceText = hospital.distance !== null ? ` • ${hospital.distance} km away` : '';
    const facilityLabel = hospital.category ? hospital.category : 'hospital';
    node.querySelector('.card__meta').textContent = `${hospital.city}, ${hospital.province} • ${facilityLabel} • ${hospital.tier}${distanceText}`;
    node.querySelector('.card__address').textContent = hospital.address || 'Address coming soon';
    node.querySelector('.card__specialists').textContent = `Specialists: ${formatSpecialists(hospital.specialists)}`;
    node.querySelector('.card__contact').textContent = `Phone: ${hospital.phone || 'N/A'}`;
    node.querySelector('.card__hours').textContent = `Hours: ${hospital.operating_hours || 'See facility for details'}`;

    const details = [
      `Facility: ${hospital.category || 'hospital'}`,
      `Type: ${hospital.type || 'Unknown'} (${hospital.ownership || 'ownership TBD'})`,
      `Beds: ${hospital.bed_count ?? 'Unknown'}`,
      hospital.manager ? `Manager: ${hospital.manager}` : '',
      hospital.website ? `Website: <a href="${hospital.website}" target="_blank" rel="noopener">${hospital.website}</a>` : '',
      `Last verified: ${hospital.last_verified || 'TBD'}`,
    ]
      .filter(Boolean)
      .map((line) => `<p>${line}</p>`) 
      .join('');

    const detailsEl = node.querySelector('.card__details');
    detailsEl.innerHTML = details;

    node.querySelector('.card__toggle').addEventListener('click', (event) => {
      const expanded = !detailsEl.hasAttribute('hidden');
      if (expanded) {
        detailsEl.setAttribute('hidden', '');
        event.currentTarget.textContent = 'More details';
      } else {
        detailsEl.removeAttribute('hidden');
        event.currentTarget.textContent = 'Hide details';
      }
    });

    fragment.appendChild(node);
  });

  resultsEl.innerHTML = '';
  resultsEl.appendChild(fragment);
};

const attachListeners = () => {
  searchInput.addEventListener('input', (event) => {
    state.filters.search = event.target.value;
    renderHospitals();
  });
  provinceFilter.addEventListener('change', (event) => {
    state.filters.province = event.target.value;
    renderHospitals();
  });
  typeFilter.addEventListener('change', (event) => {
    state.filters.type = event.target.value;
    renderHospitals();
  });
  categoryFilter.addEventListener('change', (event) => {
    state.filters.category = event.target.value;
    renderHospitals();
  });
  specialistFilter.addEventListener('change', (event) => {
    state.filters.specialist = event.target.value;
    renderHospitals();
  });
  tierFilter.addEventListener('change', (event) => {
    state.filters.tier = event.target.value;
    renderHospitals();
  });
  sortSelect.addEventListener('change', (event) => {
    state.filters.sort = event.target.value;
    renderHospitals();
  });

  locationButton.addEventListener('click', () => {
    if (!('geolocation' in navigator)) {
      state.location.status = 'error';
      locationStatus.textContent = 'Geolocation not supported on this device.';
      return;
    }
    locationStatus.textContent = 'Requesting your location...';
    navigator.geolocation.getCurrentPosition(
      (position) => {
        state.location.coords = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
        state.location.status = 'ready';
        locationStatus.textContent = 'Location enabled. Sorting by nearest now works.';
        renderHospitals();
      },
      (error) => {
        state.location.status = 'error';
        locationStatus.textContent = `Location unavailable: ${error.message}`;
      }
    );
  });
};

const init = async () => {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error('Failed to load hospitals');
    const hospitals = await response.json();
    state.hospitals = hospitals;
    renderFilters();
    renderHospitals();
  } catch (error) {
    resultsEl.innerHTML = `<p class="error">${error.message}. Please try again later.</p>`;
    console.error(error);
  }
};

attachListeners();
renderHospitals();
init();
