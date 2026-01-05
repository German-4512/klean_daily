const VENTAS_API = 'http://localhost:3001/api/ventas_tutores';
const CREDITOS_VETS_API = 'http://localhost:3001/api/creditos_vets';
const RECAUDO_VETS_API = 'http://localhost:3001/api/recaudo_vets';
const AUTH_BASE_URL = 'http://localhost:3001/api/auth';

const CBD_PRODUCTS = new Set([
  '1% 15 Ml',
  '2% 15 Ml',
  '2% 30 Ml',
  'Plan Solidario',
  '3% 100 Ml'
].map((item) => normalizeValue(item)));

const PLUS_PRODUCTS = new Set([
  'Klean Vet Plus Derma',
  'Klean Vet Plus Gastro',
  'Klean Vet Plus Adulto'
].map((item) => normalizeValue(item)));

const PLUS_RATE = 5000;

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

function isCredito(value) {
  return normalizeStatus(value) === 'credito';
}

function formatCurrency(value) {
  const numberValue = Number(value || 0);
  return numberValue.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
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
  } else if (preset === 'currentMonth') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  } else if (preset === 'prevMonth') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 1);
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

  if (preset === 'yesterday') return 'Ayer';
  if (preset === 'last7') return 'Ultimos 7 dias';
  if (preset === 'currentMonth') return 'Mes Actual';
  if (preset === 'prevMonth') return 'Mes Anterior';

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

function renderBars(container, labels, values, options = {}) {
  container.innerHTML = '';
  const formatter = options.valueFormatter || ((val) => String(val));
  const maxValue = Math.max(...values, 1);
  const maxHeight = 160;

  labels.forEach((label, index) => {
    const value = values[index] || 0;
    const bar = document.createElement('div');
    bar.className = 'bar';

    const barValue = document.createElement('div');
    barValue.className = 'bar-value';
    barValue.textContent = formatter(value);

    const barVisual = document.createElement('div');
    barVisual.className = 'bar-visual';
    const heightPx = Math.max((value / maxValue) * maxHeight, 6);
    barVisual.style.height = `${heightPx}px`;
    barVisual.title = formatter(value);

    const barLabel = document.createElement('div');
    barLabel.className = 'bar-label';
    barLabel.textContent = label;

    bar.appendChild(barValue);
    bar.appendChild(barVisual);
    bar.appendChild(barLabel);
    container.appendChild(bar);
  });
}

function buildRecaudoVetsMap(recaudos, range) {
  const map = new Map();
  (recaudos || []).forEach((item) => {
    if (range) {
      const fecha = new Date(item.fecha_recaudo || item.created_at);
      if (isNaN(fecha.getTime())) return;
      if (fecha < range.start || fecha >= range.end) return;
    }
    const id = item.venta_confirmada_id;
    if (!id) return;
    const key = String(id);
    const monto = Number(item.monto) || 0;
    const pagoInicial = Number(item.pago_inicial) || 0;
    const total = monto + pagoInicial;
    if (total <= 0) return;
    map.set(key, (map.get(key) || 0) + total);
  });
  return map;
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

function getProductName(item, confirmada) {
  return String(confirmada?.producto || item.dim_producto?.nombre_2 || item.concentracion || '').trim();
}

function matchesVet(value, selected) {
  if (!selected) return true;
  const normalized = normalizeValue(value);
  return normalized === selected;
}

function getVetsCommissionRate(totalNet) {
  if (totalNet <= 0) return 0;
  if (totalNet <= 20000000) return 0.02;
  if (totalNet <= 30000000) return 0.03;
  if (totalNet <= 40000000) return 0.055;
  if (totalNet <= 50000000) return 0.06;
  return 0.07;
}

function buildDaySeries(data, range, selectedVet) {
  const days = buildDayLabels(range);
  const indexMap = new Map(days.map((day, index) => [day.toDateString(), index]));
  const counts = Array.from({ length: days.length }, () => 0);

  data.forEach((item) => {
    const date = new Date(item.created_at);
    if (isNaN(date.getTime())) return;
    if (date < range.start || date >= range.end) return;
    if (!matchesVet(item.veterinario, selectedVet)) return;

    const confirmada = Array.isArray(item.ventas_kv_confirmadas) && item.ventas_kv_confirmadas.length
      ? item.ventas_kv_confirmadas[0]
      : null;
    if (!confirmada) return;

    const index = indexMap.get(date.toDateString());
    if (index === undefined) return;
    counts[index] += Number(confirmada.cantidad) || 0;
  });

  const labels = days.map((day) => `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`);
  return { labels, counts };
}

function buildMonthSeries(data, range, selectedVet, selector) {
  const counts = Array.from({ length: 12 }, () => 0);

  data.forEach((item) => {
    const fecha = new Date(item.created_at);
    if (isNaN(fecha.getTime())) return;
    if (fecha.getFullYear() !== range.start.getFullYear()) return;
    if (!matchesVet(item.veterinario, selectedVet)) return;

    const confirmada = Array.isArray(item.ventas_kv_confirmadas) && item.ventas_kv_confirmadas.length
      ? item.ventas_kv_confirmadas[0]
      : null;
    if (!confirmada) return;

    counts[fecha.getMonth()] += selector(confirmada);
  });

  return counts;
}

function buildRecaudoMonthMap(recaudos, year) {
  const map = new Map();
  (recaudos || []).forEach((item) => {
    const id = item.venta_confirmada_id;
    if (!id) return;
    const key = String(id);
    const totals = map.get(key) || Array.from({ length: 12 }, () => 0);

    const monto = Number(item.monto) || 0;
    const fechaMonto = new Date(item.fecha_recaudo || item.created_at);
    if (monto > 0 && !isNaN(fechaMonto.getTime()) && fechaMonto.getFullYear() === year) {
      totals[fechaMonto.getMonth()] += monto;
    }

    const pagoInicial = Number(item.pago_inicial) || 0;
    const fechaPagoInicial = new Date(item.fecha_pago_inicial || item.fecha_recaudo || item.created_at);
    if (pagoInicial > 0 && !isNaN(fechaPagoInicial.getTime()) && fechaPagoInicial.getFullYear() === year) {
      totals[fechaPagoInicial.getMonth()] += pagoInicial;
    }

    map.set(key, totals);
  });
  return map;
}

function buildMontoMonthSeries(ventasData, recaudosData, range, selectedVet) {
  const year = range.start.getFullYear();
  const counts = Array.from({ length: 12 }, () => 0);
  const recaudoByMonth = buildRecaudoMonthMap(recaudosData, year);

  ventasData.forEach((item) => {
    if (!matchesVet(item.veterinario, selectedVet)) return;
    const confirmada = Array.isArray(item.ventas_kv_confirmadas) && item.ventas_kv_confirmadas.length
      ? item.ventas_kv_confirmadas[0]
      : null;
    if (!confirmada) return;

    const metodoPago = confirmada.metodo_pago;
    if (isCredito(metodoPago)) {
      const totals = recaudoByMonth.get(String(confirmada.id));
      if (!totals) return;
      totals.forEach((value, index) => {
        counts[index] += value || 0;
      });
      return;
    }

    const fechaPago = new Date(confirmada.created_at || item.created_at);
    if (isNaN(fechaPago.getTime())) return;
    if (fechaPago.getFullYear() !== year) return;
    counts[fechaPago.getMonth()] += Number(confirmada.monto_pagado) || 0;
  });

  return counts;
}

function computeMetrics(ventasData, creditosData, recaudoMap, range, selectedVet) {
  let unidadesCBD = 0;
  let unidadesPlus = 0;
  let montoCBD = 0;
  let montoPlus = 0;
  let montoCBDComision = 0;
  const productoUnidades = new Map();
  let comisionesPlus = 0;

  ventasData.forEach((item) => {
    if (!matchesVet(item.veterinario, selectedVet)) return;

    const confirmada = Array.isArray(item.ventas_kv_confirmadas) && item.ventas_kv_confirmadas.length
      ? item.ventas_kv_confirmadas[0]
      : null;
    if (!confirmada) return;

    const date = new Date(item.created_at);
    const saleInRange = !isNaN(date.getTime()) && date >= range.start && date < range.end;
    const confirmDate = new Date(confirmada.created_at || item.created_at);
    const confirmInRange = !isNaN(confirmDate.getTime()) && confirmDate >= range.start && confirmDate < range.end;
    const paymentInRange = confirmInRange;
    const producto = getProductName(item, confirmada);
    const productoKey = String(producto).trim();
    const normalizedProduct = normalizeValue(productoKey);
    const cantidad = Number(confirmada.cantidad) || 0;
    const montoPagado = Number(confirmada.monto_pagado) || 0;
    const abono = recaudoMap?.get(String(confirmada.id)) || 0;
    const pagoCredito = isCredito(confirmada.metodo_pago);
    const montoPagadoTotal = pagoCredito ? abono : (paymentInRange ? montoPagado : 0) + abono;
    const montoPagadoRange = pagoCredito ? abono : (paymentInRange ? montoPagado : 0);

    if (saleInRange && cantidad > 0 && productoKey) {
      productoUnidades.set(productoKey, (productoUnidades.get(productoKey) || 0) + cantidad);
    }

    if (CBD_PRODUCTS.has(normalizedProduct)) {
      if (saleInRange) {
        unidadesCBD += cantidad;
      }
      if (montoPagadoRange > 0) {
        montoCBD += montoPagadoRange;
      }
      if (montoPagadoTotal > 0) {
        montoCBDComision += montoPagadoTotal;
      }
    }

    if (PLUS_PRODUCTS.has(normalizedProduct)) {
      if (saleInRange) {
        unidadesPlus += cantidad;
      }
      if (montoPagadoRange > 0) {
        montoPlus += montoPagadoRange;
      }
      if (montoPagadoTotal > 0) {
        const montoVenta = Number(confirmada.monto_venta) || 0;
        const pagoRatio = montoVenta > 0 ? Math.min(montoPagadoTotal / montoVenta, 1) : (montoPagadoTotal > 0 ? 1 : 0);
        comisionesPlus += cantidad * PLUS_RATE * pagoRatio;
      }
    }
  });

  let montoCredito = 0;
  creditosData.forEach((item) => {
    if (!isCredito(item.metodo_pago)) return;
    const fechaVenta = item.fecha_venta || item.created_at || null;
    const fecha = new Date(fechaVenta);
    if (isNaN(fecha.getTime())) return;
    if (fecha < range.start || fecha >= range.end) return;
    if (!matchesVet(item.veterinario, selectedVet)) return;

    const estado = normalizeStatus(item.estado_credito);
    if (estado === 'pazysalvo') return;

    montoCredito += Number(item.saldo_pendiente) || 0;
  });

  const comisionesCBD = montoCBDComision * getVetsCommissionRate(montoCBDComision);

  return {
    unidadesCBD,
    unidadesPlus,
    montoCBD,
    montoPlus,
    montoCredito,
    comisionesCBD,
    comisionesPlus,
    unidadesPorProducto: Array.from(productoUnidades.entries())
      .map(([producto, unidades]) => ({ producto, unidades }))
      .sort((a, b) => b.unidades - a.unidades)
  };
}

function populateVeterinarios(select, ventasData) {
  const currentValue = select.value;
  const names = new Set();

  ventasData.forEach((item) => {
    const vet = String(item.veterinario || '').trim();
    if (vet) names.add(vet);
  });

  const sorted = Array.from(names.values()).sort((a, b) => a.localeCompare(b, 'es-CO'));
  select.innerHTML = '<option value="">Todos los veterinarios</option>';

  sorted.forEach((name) => {
    const option = document.createElement('option');
    option.value = normalizeValue(name);
    option.textContent = name;
    select.appendChild(option);
  });

  if (currentValue) {
    select.value = currentValue;
  }
}

async function loadMetrics(token, rangeOptions = {}) {
  const range = buildRange(rangeOptions);
  const allTimeRange = {
    start: new Date(0),
    end: new Date(8640000000000000)
  };
  const metricsRange = (rangeOptions.month || rangeOptions.preset) ? range : allTimeRange;
  const vetSelect = document.getElementById('filter-vet');
  const selectedVet = vetSelect.value || '';

  try {
    const [ventasResponse, creditosResponse, recaudosResponse] = await Promise.all([
      fetch(VENTAS_API, {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      fetch(CREDITOS_VETS_API, {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      fetch(RECAUDO_VETS_API, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    ]);

    const ventasData = await ventasResponse.json();
    const creditosData = await creditosResponse.json();
    const recaudosData = await recaudosResponse.json();

    if (!ventasResponse.ok) {
      console.error('Error al cargar ventas:', ventasData);
      return;
    }
    if (!creditosResponse.ok) {
      console.error('Error al cargar creditos vets:', creditosData);
    }
    if (!recaudosResponse.ok) {
      console.error('Error al cargar recaudos vets:', recaudosData);
    }

    populateVeterinarios(vetSelect, ventasData);

    const recaudoMapRange = recaudosResponse.ok ? buildRecaudoVetsMap(recaudosData, range) : new Map();
    const recaudoMapMetrics = recaudosResponse.ok ? buildRecaudoVetsMap(recaudosData, metricsRange) : new Map();
    const metrics = computeMetrics(
      ventasData,
      creditosResponse.ok ? creditosData : [],
      recaudoMapMetrics,
      metricsRange,
      selectedVet
    );
    document.getElementById('metric-unidades-cbd').textContent = metrics.unidadesCBD || 0;
    document.getElementById('metric-unidades-plus').textContent = metrics.unidadesPlus || 0;
    document.getElementById('metric-monto-cbd').textContent = formatCurrency(metrics.montoCBD || 0);
    document.getElementById('metric-monto-plus').textContent = formatCurrency(metrics.montoPlus || 0);
    document.getElementById('metric-credito').textContent = formatCurrency(metrics.montoCredito || 0);
    document.getElementById('metric-comisiones-cbd').textContent = formatCurrency(metrics.comisionesCBD || 0);
    document.getElementById('metric-comisiones-plus').textContent = formatCurrency(metrics.comisionesPlus || 0);

    const dayChart = document.getElementById('chart-by-day');
    const daySeries = buildDaySeries(ventasData, range, selectedVet);
    renderBars(dayChart, daySeries.labels, daySeries.counts);

    const unitsMonthChart = document.getElementById('chart-units-by-month');
    const unitsMonthSeries = buildMonthSeries(
      ventasData,
      range,
      selectedVet,
      (confirmada) => Number(confirmada.cantidad) || 0
    );
    renderBars(unitsMonthChart, monthLabels, unitsMonthSeries);

    const montoMonthChart = document.getElementById('chart-monto-by-month');
    const montoMonthSeries = buildMontoMonthSeries(ventasData, recaudosData, range, selectedVet);
    renderBars(montoMonthChart, monthLabels, montoMonthSeries, { valueFormatter: formatCurrency });

    const productContainer = document.getElementById('chart-products');
    if (metrics.unidadesPorProducto.length) {
      const labels = metrics.unidadesPorProducto.map((item) => item.producto);
      const values = metrics.unidadesPorProducto.map((item) => item.unidades);
      const barChart = document.createElement('div');
      barChart.className = 'bar-chart';
      productContainer.classList.remove('empty-state');
      productContainer.innerHTML = '';
      productContainer.appendChild(barChart);
      renderBars(barChart, labels, values);
    } else {
      productContainer.classList.add('empty-state');
      productContainer.textContent = 'Sin datos de productos.';
    }

    const periodLabel = getPeriodLabel(rangeOptions);
    document.getElementById('chart-day-label').textContent = periodLabel;
    document.getElementById('chart-year-units-label').textContent = range.start.getFullYear();
    document.getElementById('chart-year-monto-label').textContent = range.start.getFullYear();
    document.getElementById('period-subtitle').textContent = `Resumen - ${periodLabel}`;
  } catch (error) {
    console.error('Error al cargar rendimiento vets:', error);
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

  const vetSelect = document.getElementById('filter-vet');
  const monthInput = document.getElementById('filter-month');
  const btnApply = document.getElementById('btn-apply-month');
  const btnClear = document.getElementById('btn-clear');
  const presetButtons = document.querySelectorAll('[data-preset]');

  function setActivePreset(activeButton) {
    presetButtons.forEach((btn) => btn.classList.remove('active'));
    if (activeButton) activeButton.classList.add('active');
  }

  vetSelect.addEventListener('change', () => {
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

  const defaultPreset = document.querySelector('[data-preset="currentMonth"]');
  setActivePreset(defaultPreset);
  loadMetrics(token, { preset: 'currentMonth' });
});
