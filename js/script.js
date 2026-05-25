'use strict';

const IBGE_BASE_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades';

const REGION_COLORS = {
  'Norte':       '#8D34F9',
  'Nordeste':    '#A642F4',
  'Sul':         '#FF6D01',
  'Sudeste':     '#FBBC04',
  'Centro-Oeste':'#34A853',
};

/* STATE */
const state = {
  allUfs:          [],       
  filteredUfs:     [],       
  selectedUf:      null,     
  allMunicipios:   [],       
  filteredMunic:   [],       
  selectedRegion:  '',     
  pieChart:        null,   
};

/* REFERÊNCIAS DO DOM */
const dom = {
  regionSelect:    document.getElementById('regionSelect'),
  accordionTrigger:document.getElementById('accordionTrigger'),
  accordionBody:   document.getElementById('accordionBody'),
  ufGrid:          document.getElementById('ufGrid'),
  kpiCidades:      document.getElementById('kpiCidades'),
  kpiUfId:         document.getElementById('kpiUfId'),
  kpiRegiao:       document.getElementById('kpiRegiao'),
  municipioSearch: document.getElementById('municipioSearch'),
  municipiosBody:  document.getElementById('municipiosBody'),
  toast:           document.getElementById('toast'),
  pieLegend:       document.getElementById('pieLegend'),
  kpiIdh:          document.getElementById('kpiIdh'),
  kpiCapital:      document.getElementById('kpiCapital'),
};

/* INICIALIZAÇÃO (INIT)*/
async function init() {
  await fetchAllUfs();
  renderUfButtons();
  initPieChart();
  bindEvents();
}

/* CHAMADAS DE API */
async function fetchAllUfs() {
  try {
    const response = await fetch(`${IBGE_BASE_URL}/estados?orderBy=nome`);
    if (!response.ok) throw new Error('Erro ao buscar UFs');
    state.allUfs = await response.json();
    state.filteredUfs = [...state.allUfs];
  } catch (error) {
    showToast('Erro ao carregar estados. Verifique sua conexão.');
    console.error('[IBGE] fetchAllUfs:', error);
  }
}

async function fetchMunicipiosByUf(ufId) {
  try {
    showLoadingRows();
    const response = await fetch(`${IBGE_BASE_URL}/estados/${ufId}/municipios?orderBy=nome`);
    if (!response.ok) throw new Error('Erro ao buscar municípios');
    const data = await response.json();
    state.allMunicipios = data;
    state.filteredMunic = [...data];
    return data;
  } catch (error) {
    showToast('Erro ao carregar municípios.');
    console.error('[IBGE] fetchMunicipiosByUf:', error);
    return [];
  }
}

/* RENDERIZAÇÃO: BOTÕES DE UF */
function renderUfButtons() {
  dom.ufGrid.innerHTML = '';

  const ufsToRender = state.selectedRegion
    ? state.allUfs.filter(uf => uf.regiao.nome === state.selectedRegion)
    : state.allUfs;

  state.filteredUfs = ufsToRender;

  ufsToRender.forEach(uf => {
    const btn = document.createElement('button');
    btn.className = 'uf-btn';
    btn.textContent = `${uf.nome} (${uf.sigla})`;
    btn.dataset.ufId   = uf.id;
    btn.dataset.ufSigla = uf.sigla;
    btn.setAttribute('aria-label', `Selecionar ${uf.nome}`);

    if (state.selectedUf && state.selectedUf.id === uf.id) {
      btn.classList.add('is-active');
    }

    btn.addEventListener('click', () => onUfSelected(uf, btn));
    dom.ufGrid.appendChild(btn);
  });
}

/* EVENTS*/
function bindEvents() {
  dom.accordionTrigger.addEventListener('click', toggleAccordion);

  // Filtro de região
  dom.regionSelect.addEventListener('change', onRegionChange);

  // Busca de município 
  dom.municipioSearch.addEventListener('input', onMunicipioSearch);
}

function toggleAccordion() {
  const isOpen = dom.accordionBody.classList.toggle('is-open');
  dom.accordionTrigger.setAttribute('aria-expanded', String(isOpen));
}

function onRegionChange(event) {
  state.selectedRegion = event.target.value;
  state.selectedUf = null;
  dom.municipioSearch.value = '';

  renderUfButtons();
  resetKpis();
  renderEmptyTable();
}

async function onUfSelected(uf, clickedBtn) {
  dom.ufGrid.querySelectorAll('.uf-btn').forEach(b => b.classList.remove('is-active'));
  clickedBtn.classList.add('is-active');

  state.selectedUf = uf;
  dom.municipioSearch.value = '';

  
  setKpiUpdating(true);

  const municipios = await fetchMunicipiosByUf(uf.id);

  updateKpis(uf, municipios.length);
  setKpiUpdating(false);
  renderMunicipiosTable(municipios);
}

function onMunicipioSearch(event) {
  const query = event.target.value.trim().toLowerCase();

  if (!query) {
    state.filteredMunic = [...state.allMunicipios];
  } else {
    state.filteredMunic = state.allMunicipios.filter(m => {
      const nomeMatch = m.nome.toLowerCase().includes(query);
      const idMatch   = String(m.id).includes(query);
      return nomeMatch || idMatch;
    });
  }

  renderMunicipiosTable(state.filteredMunic);
}

/* TABLE */
function renderMunicipiosTable(municipios) {
  dom.municipiosBody.innerHTML = '';

  if (!municipios || municipios.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'data-table__no-results';
    tr.innerHTML = '<td colspan="2">Nenhum município encontrado.</td>';
    dom.municipiosBody.appendChild(tr);
    return;
  }

  const fragment = document.createDocumentFragment();

  municipios.forEach(municipio => {
    const tr = document.createElement('tr');

    const tdNome = document.createElement('td');
    const link   = document.createElement('a');
    link.className    = 'data-table__link';
    link.textContent  = municipio.nome;
    link.href         = buildGoogleMapsUrl(municipio.nome, state.selectedUf?.sigla);
    link.target       = '_blank';
    link.rel          = 'noopener noreferrer';
    link.title        = `Abrir ${municipio.nome} no Google Maps`;
    tdNome.appendChild(link);

    const tdId = document.createElement('td');
    tdId.textContent = municipio.id;

    tr.appendChild(tdNome);
    tr.appendChild(tdId);
    fragment.appendChild(tr);
  });

  dom.municipiosBody.appendChild(fragment);
}

function showLoadingRows() {
  dom.municipiosBody.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const tr  = document.createElement('tr');
    tr.className = 'loading-row';
    tr.innerHTML = `
      <td><div class="loading-cell skeleton" style="width:${60 + Math.random()*30}%"></div></td>
      <td><div class="loading-cell skeleton" style="width:70px"></div></td>
    `;
    dom.municipiosBody.appendChild(tr);
  }
}

function renderEmptyTable() {
  dom.municipiosBody.innerHTML = `
    <tr class="data-table__empty">
      <td colspan="2">Selecione uma UF para ver os municípios.</td>
    </tr>
  `;
}

const MOCK_METRICS = {
  11: { idh: '0.725', logistica: 'Média (Porto Velho)' },
  12: { idh: '0.719', logistica: 'Baixa (Rio Branco)' },
  13: { idh: '0.733', logistica: 'Alta (Manaus)' },
  14: { idh: '0.752', logistica: 'Baixa (Boa Vista)' },
  15: { idh: '0.698', logistica: 'Média (Belém)' },
  16: { idh: '0.733', logistica: 'Baixa (Macapá)' },
  17: { idh: '0.743', logistica: 'Média (Palmas)' },
  21: { idh: '0.687', logistica: 'Média (São Luís)' },
  22: { idh: '0.697', logistica: 'Média (Teresina)' },
  23: { idh: '0.735', logistica: 'Alta (Fortaleza)' },
  24: { idh: '0.731', logistica: 'Média (Natal)' },
  25: { idh: '0.722', logistica: 'Média (João Pessoa)' },
  26: { idh: '0.727', logistica: 'Alta (Recife)' },
  27: { idh: '0.683', logistica: 'Média (Maceió)' },
  28: { idh: '0.702', logistica: 'Média (Aracaju)' },
  29: { idh: '0.714', logistica: 'Alta (Salvador)' },
  31: { idh: '0.787', logistica: 'Alta (Belo Horizonte)' },
  32: { idh: '0.772', logistica: 'Média (Vitória)' },
  33: { idh: '0.796', logistica: 'Muito Alta (Rio de Janeiro)' },
  35: { idh: '0.826', logistica: 'Muito Alta (São Paulo)' },
  41: { idh: '0.792', logistica: 'Alta (Curitiba)' },
  42: { idh: '0.808', logistica: 'Alta (Florianópolis)' },
  43: { idh: '0.787', logistica: 'Alta (Porto Alegre)' },
  50: { idh: '0.766', logistica: 'Média (Campo Grande)' },
  51: { idh: '0.774', logistica: 'Média (Cuiabá)' },
  52: { idh: '0.769', logistica: 'Alta (Goiânia)' },
  53: { idh: '0.850', logistica: 'Muito Alta (Brasília)' }
};

/* KPI HELPERS */
function updateKpis(uf, count) {
  dom.kpiCidades.textContent = count.toLocaleString('pt-BR');
  dom.kpiUfId.textContent    = uf.id;
  dom.kpiRegiao.textContent  = uf.regiao.nome;

  const metrics = MOCK_METRICS[uf.id];
  if (metrics) {
    dom.kpiIdh.textContent = metrics.idh;
    dom.kpiCapital.textContent = metrics.logistica;
  } else {
    dom.kpiIdh.textContent = '—';
    dom.kpiCapital.textContent = '—';
  }
}

function resetKpis() {
  dom.kpiCidades.textContent = '—';
  dom.kpiUfId.textContent    = '—';
  dom.kpiRegiao.textContent  = '—';
  if (dom.kpiIdh) dom.kpiIdh.textContent = '—';
  if (dom.kpiCapital) dom.kpiCapital.textContent = '—';
}

function setKpiUpdating(isUpdating) {
  [dom.kpiCidades, dom.kpiUfId, dom.kpiRegiao, dom.kpiIdh, dom.kpiCapital].forEach(el => {
    if (el) el.classList.toggle('is-updating', isUpdating);
  });
}

/* GRÁFICO DE PIZZA */
function initPieChart() {
  // Contar UFs por região
  const regionCounts = countUfsByRegion(state.allUfs);
  const labels  = Object.keys(regionCounts);
  const data    = Object.values(regionCounts);
  const colors  = labels.map(l => REGION_COLORS[l] || '#ccc');

  const ctx = document.getElementById('ufsPieChart').getContext('2d');

  state.pieChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} UFs`,
          },
          titleFont: { family: 'Montserrat', weight: 700 },
          bodyFont:  { family: 'Montserrat' },
        },
      },
    },
  });

  renderPieLegend(labels, colors, data);
}

function countUfsByRegion(ufs) {
  const counts = {};
  ufs.forEach(uf => {
    const regiao = uf.regiao.nome;
    counts[regiao] = (counts[regiao] || 0) + 1;
  });
  return counts;
}

function renderPieLegend(labels, colors, data) {
  dom.pieLegend.innerHTML = '';
  labels.forEach((label, i) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `
      <span class="legend-dot" style="background:${colors[i]}"></span>
      <span>${label}</span>
    `;
    dom.pieLegend.appendChild(item);
  });
}

/* UTILITIES*/
function buildGoogleMapsUrl(municipioNome, ufSigla) {
  const query = encodeURIComponent(`${municipioNome}${ufSigla ? ', ' + ufSigla : ''}, Brasil`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

let toastTimer = null;
function showToast(message, duration = 3500) {
  dom.toast.textContent = message;
  dom.toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('is-visible'), duration);
}

document.addEventListener('DOMContentLoaded', init);