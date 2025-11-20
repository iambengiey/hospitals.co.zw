import { EMBEDDED_HOSPITALS } from './embedded-data.js';

const DATA_SOURCES = (() => {
  const sources = ['data/hospitals.json', './data/hospitals.json', '../data/hospitals.json'];
  const hostParts = window.location.hostname.split('.');
  const owner = window.location.hostname.endsWith('github.io') ? hostParts[0] : null;
  if (owner) {
    sources.push(`https://raw.githubusercontent.com/${owner}/hospitals.co.zw/main/data/hospitals.json`);
    sources.push(`https://cdn.jsdelivr.net/gh/${owner}/hospitals.co.zw@main/data/hospitals.json`);
  }
  return sources;
})();

const state = {
  hospitals: [],
  usedFallback: false,
  filters: {
    province: '',
    type: '',
    category: '',
    tier: '',
    specialist: '',
    sort: 'name',
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

const provinceFilter = document.getElementById('province-filter');
const typeFilter = document.getElementById('type-filter');
const categoryFilter = document.getElementById('category-filter');
const tierFilter = document.getElementById('tier-filter');
const specialistFilter = document.getElementById('specialist-filter');
const sortSelect = document.getElementById('sort');
const resultsEl = document.getElementById('results');
const fallbackEl = document.getElementById('data-fallback');
const template = document.getElementById('hospital-card');

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

const renderHospitals = () => {
  if (!state.hospitals.length) {
    resultsEl.innerHTML = '<p>Loading hospitals...</p>';
    return;
  }

  const filtered = state.hospitals
    .map((hospital) => ({ ...hospital, tier: tierHelper(hospital) }))
    .filter((hospital) => {
      const { province, type, category, tier, specialist } = state.filters;
      const matchesProvince = province ? hospital.province === province : true;
      const matchesType = type ? hospital.type === type : true;
      const matchesCategory = category ? hospital.category === category : true;
      const matchesTier = tier ? hospital.tier === tier : true;
      const matchesSpecialist = specialist
        ? (hospital.specialists || []).some((spec) => spec.toLowerCase().includes(specialist.toLowerCase()))
        : true;
      return matchesProvince && matchesType && matchesCategory && matchesTier && matchesSpecialist;
    })
    .sort((a, b) => {
      if (state.filters.sort === 'bed_desc') {
        return (b.bed_count || 0) - (a.bed_count || 0);
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
    const facilityLabel = hospital.category ? hospital.category : 'hospital';
    node.querySelector('.card__meta').textContent = `${hospital.city}, ${hospital.province} • ${facilityLabel} • ${hospital.tier}`;
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

const init = async () => {
  try {
    const { data, fromFallback, lastError } = await loadHospitals();
    state.hospitals = data;
    state.usedFallback = fromFallback;
    toggleFallbackNotice(fromFallback, lastError);
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
