const API_BASE_URL = 'http://localhost:3001/api/preventascall';
const AUTH_BASE_URL = 'http://localhost:3001/api/auth';
const ADVISORS_URL = 'http://localhost:3001/api/preventascall/advisors';
const RECAUDO_API_BASE_URL = 'http://localhost:3001/api/recaudo_call';

const PRODUCTS = [
  { name: '1% 15 Ml', rate: 5000 },
  { name: '2% 15 Ml', rate: 5000 },
  { name: '2% 30 Ml', rate: 10000 },
  { name: '3% 100 Ml', rate: 10000 },
  { name: 'Gastro Plus', rate: 5000 },
  { name: 'Derma Plus', rate: 5000 },
  { name: 'Adulto Plus', rate: 5000 }
];

const productMap = new Map(
  PRODUCTS.map((item) => [normalizeValue(item.name), item])
);

const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function normalizeValue(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizeStatus(value) {
  return normalizeValue(value).replace(/[^a-z]/g, '');
}

function isConfirmada(value) {
  const normalized = normalizeStatus(value);
  return normalized === 'confirmada' || normalized === 'confirmado';
}

function isCredito(value) {
  return normalizeStatus(value) === 'credito';
}

function formatCurrency(value) {
  const numberValue = Number(value || 0);
  return numberValue.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

function buildPazYSalvoMap(recaudos) {
  const map = new Map();
  (recaudos || []).forEach((item) => {
    const tipo = normalizeStatus(item.tipo_recaudo);
    if (tipo !== 'pazysalvo') return;
    if (!item.preventa_id) return;
    const prev = map.get(item.preventa_id);
    const fecha = new Date(item.fecha_recaudo);
    if (!prev || (!isNaN(fecha.getTime()) && fecha > prev.fecha)) {
      map.set(item.preventa_id, { fecha });
    }
  });
  return map;
}

function isDateInRange(dateValue, range) {
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return false;
  return date >= range.start && date < range.end;
}

function isSameMonth(dateA, dateB) {
  return dateA.getFullYear() === dateB.getFullYear()
    && dateA.getMonth() === dateB.getMonth();
}

function buildRange({ preset, month }) {
  const now = new Date();
  let start;
  let end;

  if (month) {
    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (Number.isFinite(year) && Number.isFinite(monthIndex)) {
      start = new Date(year, monthIndex, 1);
      end = new Date(year, monthIndex + 1, 1);
    }
  } else if (preset === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (preset === 'yesterday') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (preset === 'last7') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }

  if (!start || !end) {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  return { start, end };
}

function getPeriodLabel({ preset, month }) {
  if (month) {
    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (Number.isFinite(year) && Number.isFinite(monthIndex)) {
      const label = new Date(year, monthIndex, 1).toLocaleString('es-CO', { month: 'long' });
      return `${label.charAt(0).toUpperCase() + label.slice(1)} ${year}`;
    }
  }

  if (preset === 'today') return 'Hoy';
  if (preset === 'yesterday') return 'Ayer';
  if (preset === 'last7') return 'Ultimos 7 dias';

  return 'Mes Actual';
}

function buildDayLabels(range) {
  const days = [];
  const cursor = new Date(range.start);
  while (cursor < range.end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function renderBars(container, labels, values) {
  container.innerHTML = '';
  const maxValue = Math.max(...values, 1);
  const maxHeight = 160;

  labels.forEach((label, index) => {
    const value = values[index] || 0;
    const bar = document.createElement('div');
    bar.className = 'bar';

    const barValue = document.createElement('div');
    barValue.className = 'bar-value';
    barValue.textContent = String(value);

    const barVisual = document.createElement('div');
    barVisual.className = 'bar-visual';
    const heightPx = Math.max((value / maxValue) * maxHeight, 6);
    barVisual.style.height = `${heightPx}px`;
    barVisual.title = String(value);

    const barLabel = document.createElement('div');
    barLabel.className = 'bar-label';
    barLabel.textContent = label;

    bar.appendChild(barValue);
    bar.appendChild(barVisual);
    bar.appendChild(barLabel);
    container.appendChild(bar);
  });
}

async function verifyAccess() {
  const token = localStorage.getItem('supabase-session-token');
  if (!token) {
    window.location.href = 'inicio_sesion.html';
    return null;
  }

  try {
    const response = await fetch(`${AUTH_BASE_URL}/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      window.location.href = 'inicio_sesion.html';
      return null;
    }

    const data = await response.json();
    const role = (data.profile?.rol || '').trim().toLowerCase();
    const estado = (data.profile?.estado || '').trim().toLowerCase();
    const isAgenteMayor = role === 'agente mayor' && estado === 'activo';
    const isInvitado = role === 'invitado';
    if (role !== 'datos y ventas klean vet' && role !== 'admin' && !isAgenteMayor && !isInvitado) {
      window.location.href = 'inicio_sesion.html';
      return null;
    }

    return token;
  } catch (error) {
    window.location.href = 'inicio_sesion.html';
    return null;
  }
}

async function loadAdvisors(token) {
  const select = document.getElementById('filter-advisor');
  select.innerHTML = '<option value="">Todos los asesores</option>';

  try {
    const response = await fetch(ADVISORS_URL, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Error al cargar asesores:', data);
      return;
    }

    data.forEach((advisor) => {
      const option = document.createElement('option');
      option.value = advisor.id;
      option.textContent = advisor.nombre_apellido || advisor.email || 'Asesor';
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error al cargar asesores:', error);
  }
}

function computeMetrics(data, range, advisorId, pazYSalvoMap) {
  const filtered = [];
  data.forEach((item) => {
    if (advisorId && item.agente_id !== advisorId) return;
    if (!isConfirmada(item.estado_preventa)) return;
    if (!isDateInRange(item.fechapreventa, range)) return;
    filtered.push(item);
  });

  const totalPreventas = filtered.length;
  const clientesSet = new Set();
  const productoUnidades = new Map();
  let totalUnidades = 0;
  let totalComisionesNetas = 0;
  let totalComisionesRetenidas = 0;

  filtered.forEach((item) => {
    const doc = String(item.num_doc || '').trim();
    if (doc) clientesSet.add(doc);

    for (let i = 1; i <= 4; i += 1) {
      const producto = item[`produc_${i}`];
      const cantidad = Number(item[`cant_${i}`]) || 0;
      if (!producto && cantidad > 0) {
        totalUnidades += cantidad;
        continue;
      }
      if (!producto || cantidad <= 0) continue;

      const key = String(producto).trim();
      productoUnidades.set(key, (productoUnidades.get(key) || 0) + cantidad);
      totalUnidades += cantidad;
    }
  });

  data.forEach((item) => {
    if (advisorId && item.agente_id !== advisorId) return;
    if (!isConfirmada(item.estado_preventa)) return;

    const fechaPreventa = new Date(item.fechapreventa);
    const inPreventaRange = !isNaN(fechaPreventa.getTime()) && fechaPreventa >= range.start && fechaPreventa < range.end;
    const credito = isCredito(item.metodo_pago);
    const pazYSalvoEntry = credito ? pazYSalvoMap?.get(item.id) : null;
    const fechaRecaudo = pazYSalvoEntry?.fecha || null;
    const hasPazYSalvo = credito ? Boolean(fechaRecaudo) : true;
    const inRecaudoRange = fechaRecaudo ? isDateInRange(fechaRecaudo, range) : false;
    const sameMonthRecaudo = fechaRecaudo && !isNaN(fechaPreventa.getTime())
      ? (inPreventaRange && isSameMonth(fechaRecaudo, fechaPreventa))
      : false;

    for (let i = 1; i <= 4; i += 1) {
      const producto = item[`produc_${i}`];
      const cantidad = Number(item[`cant_${i}`]) || 0;
      if (!producto || cantidad <= 0) continue;

      const rate = productMap.get(normalizeValue(producto))?.rate || 0;
      if (credito) {
        if (hasPazYSalvo) {
          if (inRecaudoRange || sameMonthRecaudo) {
            totalComisionesNetas += rate * cantidad;
          }
        } else if (inPreventaRange) {
          totalComisionesRetenidas += rate * cantidad;
        }
      } else if (inPreventaRange) {
        totalComisionesNetas += rate * cantidad;
      }
    }
  });

  return {
    totalPreventas,
    totalClientes: clientesSet.size,
    totalUnidades,
    totalComisionesNetas,
    totalComisionesRetenidas,
    unidadesPorProducto: Array.from(productoUnidades.entries())
      .map(([producto, unidades]) => ({ producto, unidades }))
      .sort((a, b) => b.unidades - a.unidades)
  };
}

function buildDaySeries(data, range, advisorId, useMonthLabels) {
  const days = buildDayLabels(range);
  const counts = Array.from({ length: days.length }, () => 0);

  data.forEach((item) => {
    if (advisorId && item.agente_id !== advisorId) return;
    if (!isConfirmada(item.estado_preventa)) return;
    const fecha = new Date(item.fechapreventa);
    if (isNaN(fecha.getTime())) return;
    if (fecha < range.start || fecha >= range.end) return;

    const index = days.findIndex((day) => day.toDateString() === fecha.toDateString());
    if (index >= 0) counts[index] += 1;
  });

  const labels = days.map((day) => {
    if (useMonthLabels) return String(day.getDate());
    return `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`;
  });

  return { labels, counts };
}

function buildMonthSeries(data, range, advisorId) {
  const year = new Date(range.start).getFullYear();
  const counts = Array.from({ length: 12 }, () => 0);

  data.forEach((item) => {
    if (advisorId && item.agente_id !== advisorId) return;
    if (!isConfirmada(item.estado_preventa)) return;
    const fecha = new Date(item.fechapreventa);
    if (isNaN(fecha.getTime())) return;
    if (fecha < range.start || fecha >= range.end) return;
    if (fecha.getFullYear() !== year) return;
    let unidades = 0;
    for (let i = 1; i <= 4; i += 1) {
      const cantidad = Number(item[`cant_${i}`]) || 0;
      if (cantidad > 0) unidades += cantidad;
    }
    counts[fecha.getMonth()] += unidades;
  });

  return counts;
}

function buildUniqueClientsMonthSeries(data, range, advisorId) {
  const year = new Date(range.start).getFullYear();
  const monthSets = Array.from({ length: 12 }, () => new Set());

  data.forEach((item) => {
    if (advisorId && item.agente_id !== advisorId) return;
    if (!isConfirmada(item.estado_preventa)) return;
    const doc = String(item.num_doc || '').trim();
    if (!doc) return;
    const fecha = new Date(item.fechapreventa);
    if (isNaN(fecha.getTime())) return;
    if (fecha < range.start || fecha >= range.end) return;
    if (fecha.getFullYear() !== year) return;
    monthSets[fecha.getMonth()].add(doc);
  });

  return monthSets.map((set) => set.size);
}

async function loadMetrics(token, rangeOptions = {}) {
  const range = buildRange(rangeOptions);
  const advisorId = document.getElementById('filter-advisor').value;

  const params = new URLSearchParams();
  params.append('all', 'true');

  try {
    const [preventasResponse, recaudosResponse] = await Promise.all([
      fetch(`${API_BASE_URL}?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      fetch(RECAUDO_API_BASE_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    ]);

    const data = await preventasResponse.json();
    const recaudos = await recaudosResponse.json();
    if (!preventasResponse.ok) {
      console.error('Error al cargar preventas:', data);
      return;
    }
    if (!recaudosResponse.ok) {
      console.error('Error al cargar recaudos:', recaudos);
    }

    const pazYSalvoMap = recaudosResponse.ok ? buildPazYSalvoMap(recaudos) : new Map();
    const metrics = computeMetrics(data, range, advisorId, pazYSalvoMap);
    document.getElementById('metric-preventas').textContent = metrics.totalPreventas || 0;
    document.getElementById('metric-clientes').textContent = metrics.totalClientes || 0;
    document.getElementById('metric-comisiones').textContent = formatCurrency(metrics.totalComisionesNetas || 0);
    document.getElementById('metric-retenidas').textContent = formatCurrency(metrics.totalComisionesRetenidas || 0);
    document.getElementById('metric-unidades').textContent = metrics.totalUnidades || 0;

    const useMonthLabels = !rangeOptions.preset || rangeOptions.month;
    const dayChart = document.getElementById('chart-by-day');
    const daySeries = buildDaySeries(data, range, advisorId, useMonthLabels);
    renderBars(dayChart, daySeries.labels, daySeries.counts);

    const monthChart = document.getElementById('chart-by-month');
    renderBars(monthChart, monthLabels, buildMonthSeries(data, range, advisorId));

    const clientsMonthChart = document.getElementById('chart-clients-by-month');
    renderBars(clientsMonthChart, monthLabels, buildUniqueClientsMonthSeries(data, range, advisorId));

    const productContainer = document.getElementById('chart-products');
    if (metrics.unidadesPorProducto.length) {
      const labels = metrics.unidadesPorProducto.map((item) => item.producto);
      const values = metrics.unidadesPorProducto.map((item) => item.unidades);
      const barChart = document.createElement('div');
      barChart.className = 'bar-chart';
      productContainer.innerHTML = '';
      productContainer.appendChild(barChart);
      renderBars(barChart, labels, values);
    } else {
      productContainer.textContent = 'Sin datos de productos.';
    }

    const periodLabel = getPeriodLabel(rangeOptions);
    document.getElementById('chart-month-label').textContent = periodLabel;
    document.getElementById('chart-year-label').textContent = new Date(range.start).getFullYear();
    document.getElementById('chart-clients-year-label').textContent = new Date(range.start).getFullYear();
    document.getElementById('period-subtitle').textContent = `Resumen - ${periodLabel}`;
  } catch (error) {
    console.error('Error al cargar rendimiento:', error);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const token = await verifyAccess();
  if (!token) return;

  document.getElementById('btn-back').addEventListener('click', () => window.history.back());

  document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('supabase-session-token');
    localStorage.removeItem('user-rol');
    localStorage.removeItem('user-estado');
    window.location.href = 'inicio_sesion.html';
  });

  await loadAdvisors(token);

  const advisorSelect = document.getElementById('filter-advisor');
  const monthInput = document.getElementById('filter-month');
  const btnApply = document.getElementById('btn-apply-month');
  const btnClear = document.getElementById('btn-clear');
  const presetButtons = document.querySelectorAll('[data-preset]');

  function setActivePreset(activeButton) {
    presetButtons.forEach((btn) => btn.classList.remove('active'));
    if (activeButton) activeButton.classList.add('active');
  }

  advisorSelect.addEventListener('change', () => {
    loadMetrics(token, { month: monthInput.value });
  });

  btnApply.addEventListener('click', () => {
    const monthValue = monthInput.value;
    setActivePreset(null);
    loadMetrics(token, { month: monthValue });
  });

  btnClear.addEventListener('click', () => {
    monthInput.value = '';
    setActivePreset(null);
    loadMetrics(token, {});
  });

  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      setActivePreset(btn);
      monthInput.value = '';
      loadMetrics(token, { preset });
    });
  });

  loadMetrics(token, {});
});
