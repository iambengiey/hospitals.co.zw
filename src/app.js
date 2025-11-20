const EMBEDDED_HOSPITALS = window.EMBEDDED_HOSPITALS || [];

const DATA_SOURCES = (() => {
  const REPO_OWNER = 'iambengiey';
  const REPO_NAME = 'hospitals.co.zw';
  const sources = ['data/hospitals.json', './data/hospitals.json', '../data/hospitals.json'];

  // Always include the canonical raw URLs so fresh data loads without a site redeploy.
  sources.push(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/data/hospitals.json`);
  sources.push(`https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@main/data/hospitals.json`);

  // If the site is served from *.github.io, also include the inferred owner for forks.
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
  // Seed with embedded data so filters/cards populate even if fetch fails or hangs.
  hospitals: [...EMBEDDED_HOSPITALS],
  usedFallback: true,
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
  const descriptor = (hospital.specialists || []).map((spec) => spec.toLowerCase());
  const typeValue = (hospital.type || '').toLowerCase();
  const categoryValue = (hospital.category || '').toLowerCase();
  const hasTier1Discipline = descriptor.some((spec) => TIER1_SPECIALISTS.some((key) => spec.includes(key)));
  const hasMultipleSpecialists = descriptor.length >= 2;

  // Based on "Overview of Zim Healthcare System 2025":
  // - Tier 1: central/teaching/referral hospitals or sites with >350 beds or critical disciplines (oncology, ICU, etc.)
  const isCentral =
    typeValue.includes('central') ||
    typeValue.includes('referral') ||
    typeValue.includes('teaching') ||
    typeValue.includes('university') ||
    categoryValue.includes('central');
  if (isCentral || (bedCount !== null && bedCount >= 350) || hasTier1Discipline) {
    return 'T1';
  }

  // - Tier 2: provincial/district general hospitals and high-volume facilities with 120–349 beds or multi-specialty cover.
  const isProvincialOrDistrict =
    typeValue.includes('provincial') || typeValue.includes('general') || typeValue.includes('district');
  if ((bedCount !== null && bedCount >= 120) || isProvincialOrDistrict || hasMultipleSpecialists) {
    return 'T2';
  }

  // - Tier 3: primary/rural/mission clinics and small facilities under 120 beds or with unknown capacity.
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
  // Render immediately with the embedded copy while fetching the canonical file.
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
    renderHospitals();
  } catch (error) {
    resultsEl.innerHTML = `<p class="error">${error.message}. Please try again later.</p>`;
    console.error(error);
  }
};

attachListeners();
init();
