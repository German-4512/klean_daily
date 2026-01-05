const PREVENTAS_API = '/api/preventascall';
const VENTAS_API = '/api/ventas_tutores';
const AUTH_BASE_URL = '/api/auth';
const ADVISORS_URL = '/api/preventascall/advisors';
const RECAUDO_API_BASE_URL = '/api/recaudo_call';
const RECAUDO_VETS_API_BASE_URL = '/api/recaudo_vets';

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

function normalizePago(value) {
  const normalized = normalizeStatus(value);
  if (normalized === 'credito') return 'credito';
  if (normalized === 'decontado' || normalized === 'contado') return 'contado';
  if (normalized.includes('contraentrega')) return 'contraentrega';
  return 'otro';
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

function buildRecaudoVetsMap(recaudos, range) {
  const map = new Map();
  (recaudos || []).forEach((item) => {
    const fecha = new Date(item.fecha_recaudo);
    if (isNaN(fecha.getTime())) return;
    if (fecha < range.start || fecha >= range.end) return;
    const id = item.venta_confirmada_id;
    if (!id) return;
    const monto = Number(item.monto) || 0;
    if (monto <= 0) return;
    const key = String(id);
    map.set(key, (map.get(key) || 0) + monto);
  });
  return map;
}

function getVetsCommissionRate(totalNet) {
  if (totalNet <= 0) return 0;
  if (totalNet <= 20000000) return 0.02;
  if (totalNet <= 30000000) return 0.03;
  if (totalNet <= 40000000) return 0.055;
  if (totalNet <= 50000000) return 0.06;
  return 0.07;
}

const VETS_RATE_PRODUCTS = new Set([
  '1% 15 ml',
  '2% 15 ml',
  '2% 30 ml',
  'plan solidario',
  '3% 100 ml'
].map((item) => normalizeValue(item)));

const VETS_BONUS_PRODUCTS = new Map([
  ['klean vet plus adulto', 5000],
  ['klean vet plus derma', 5000],
  ['klean vet plus gastro', 5000]
].map(([name, rate]) => [normalizeValue(name), rate]));
const VETS_PLUS_PRODUCTS = new Set(VETS_BONUS_PRODUCTS.keys());
const VETS_PLUS_RATE = 5000;

function getVetsProductType(item, confirmada) {
  const tipo = normalizeValue(item.dim_producto?.tipo_producto || '');
  if (tipo.includes('cbd')) return 'cbd';
  if (tipo.includes('plus')) return 'plus';

  const producto = confirmada?.producto || item.dim_producto?.nombre_2 || item.concentracion || '';
  const normalized = normalizeValue(String(producto).trim());
  if (VETS_RATE_PRODUCTS.has(normalized)) return 'cbd';
  if (VETS_PLUS_PRODUCTS.has(normalized)) return 'plus';
  return '';
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

function renderBars(container, labels, values, options = {}) {
  container.innerHTML = '';
  const formatter = options.valueFormatter || ((val) => String(val));
  const barClass = options.barClass || '';
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
    if (barClass) barVisual.classList.add(barClass);
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

function renderGroupedBars(container, labels, series) {
  container.innerHTML = '';
  container.classList.add('grouped-chart');
  const maxValue = Math.max(...series.flatMap((item) => item.values), 1);
  const maxHeight = 160;

  labels.forEach((label, index) => {
    const bar = document.createElement('div');
    bar.className = 'grouped-bar';

    const valueRow = document.createElement('div');
    valueRow.className = 'bar-value';
    valueRow.textContent = series.map((item) => item.values[index] || 0).join(' / ');

    const stack = document.createElement('div');
    stack.className = 'grouped-stack';

    series.forEach((item) => {
      const value = item.values[index] || 0;
      const barVisual = document.createElement('div');
      barVisual.className = `bar-visual ${item.className || ''}`;
      const heightPx = Math.max((value / maxValue) * maxHeight, 6);
      barVisual.style.height = `${heightPx}px`;
      barVisual.title = String(value);
      stack.appendChild(barVisual);
    });

    const barLabel = document.createElement('div');
    barLabel.className = 'bar-label';
    barLabel.textContent = label;

    bar.appendChild(valueRow);
    bar.appendChild(stack);
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
    if (role !== 'datos y ventas klean vet' && role !== 'admin' && !isAgenteMayor) {
      window.location.href = 'inicio_sesion.html';
      return null;
    }

    return token;
  } catch (error) {
    window.location.href = 'inicio_sesion.html';
    return null;
  }
}

function computePreventasMetrics(data, range, pazYSalvoMap) {
  const filtered = data.filter((item) => {
    const fecha = new Date(item.fechapreventa);
    if (isNaN(fecha.getTime())) return false;
    return fecha >= range.start && fecha < range.end;
  });

  const totalPreventas = filtered.length;
  const clientesSet = new Set();
  const productoUnidades = new Map();
  let totalUnidades = 0;
  let totalComisionesNetas = 0;
  let totalRetenidas = 0;

  filtered.forEach((item) => {
    const doc = String(item.num_doc || '').trim();
    if (doc) clientesSet.add(doc);

    if (!isConfirmada(item.estado_preventa)) return;
    const credito = isCredito(item.metodo_pago);
    const pazYSalvo = credito ? pazYSalvoMap?.has(item.id) : true;

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

      const rate = productMap.get(normalizeValue(producto))?.rate || 0;
      if (credito && !pazYSalvo) {
        totalRetenidas += rate * cantidad;
      } else {
        totalComisionesNetas += rate * cantidad;
      }
    }
  });

  return {
    totalPreventas,
    totalClientes: clientesSet.size,
    totalUnidades,
    totalComisionesNetas,
    totalRetenidas,
    unidadesPorProducto: Array.from(productoUnidades.entries())
      .map(([producto, unidades]) => ({ producto, unidades }))
      .sort((a, b) => b.unidades - a.unidades)
  };
}

function buildDaySeries(range, data, getDate, getValue) {
  const days = buildDayLabels(range);
  const indexMap = new Map(days.map((day, index) => [day.toDateString(), index]));
  const counts = Array.from({ length: days.length }, () => 0);

  data.forEach((item) => {
    const date = getDate(item);
    if (!date || isNaN(date.getTime())) return;
    if (date < range.start || date >= range.end) return;
    const index = indexMap.get(date.toDateString());
    if (index === undefined) return;
    counts[index] += getValue(item);
  });

  const labels = days.map((day) => `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`);
  return { labels, counts };
}

function buildMonthSeries(data, year) {
  const counts = Array.from({ length: 12 }, () => 0);

  data.forEach((item) => {
    const fecha = new Date(item.fechapreventa);
    if (isNaN(fecha.getTime())) return;
    if (fecha.getFullYear() !== year) return;
    if (!isConfirmada(item.estado_preventa)) return;
    let unidades = 0;
    for (let i = 1; i <= 4; i += 1) {
      unidades += Number(item[`cant_${i}`]) || 0;
    }
    counts[fecha.getMonth()] += unidades;
  });

  return counts;
}

function computeVetsCommissionsTotal(data, range) {
  let cbdPaidTotal = 0;
  let plusCommissions = 0;

  data.forEach((item) => {
    const confirmada = Array.isArray(item.ventas_kv_confirmadas) && item.ventas_kv_confirmadas.length
      ? item.ventas_kv_confirmadas[0]
      : null;
    if (!confirmada) return;

    const paymentDate = new Date(confirmada.created_at || item.created_at);
    if (isNaN(paymentDate.getTime()) || paymentDate < range.start || paymentDate >= range.end) return;

    const tipoProducto = getVetsProductType(item, confirmada);
    const montoPagado = Number(confirmada.monto_pagado) || 0;
    if (montoPagado <= 0) return;

    if (tipoProducto === 'cbd') {
      cbdPaidTotal += montoPagado;
    } else if (tipoProducto === 'plus') {
      const montoVenta = Number(confirmada.monto_venta) || 0;
      const pagoRatio = montoVenta > 0 ? Math.min(montoPagado / montoVenta, 1) : 1;
      plusCommissions += VETS_PLUS_RATE * pagoRatio;
    }
  });

  const cbdCommissions = cbdPaidTotal * getVetsCommissionRate(cbdPaidTotal);
  return cbdCommissions + plusCommissions;
}

function computeVentasMetrics(data, range) {
  let totalUnidades = 0;
  let totalMontoNet = 0;
  let totalCredito = 0;
  const pagoTotals = {
    contado: 0,
    contraentrega: 0,
    credito: 0
  };

  data.forEach((item) => {
    const confirmada = Array.isArray(item.ventas_kv_confirmadas) && item.ventas_kv_confirmadas.length
      ? item.ventas_kv_confirmadas[0]
      : null;
    if (!confirmada) return;

    const date = new Date(confirmada.created_at || item.created_at);
    if (isNaN(date.getTime())) return;
    if (date < range.start || date >= range.end) return;

    const cantidad = Number(confirmada.cantidad) || 0;
    const montoPagado = Number(confirmada.monto_pagado) || 0;
    const saldoPendiente = Number(confirmada.saldo_pendiente) || 0;
    const metodo = normalizePago(confirmada.metodo_pago);
    const producto = confirmada.producto || item.dim_producto?.nombre_2 || item.concentracion || '';
    const productoKey = String(producto).trim();

    totalUnidades += cantidad;
    totalMontoNet += montoPagado;
    pagoTotals.contado += montoPagado;
    if (metodo === 'credito') {
      totalCredito += saldoPendiente;
      pagoTotals.credito += saldoPendiente;
    } else if (metodo === 'contraentrega') {
      pagoTotals.contraentrega += montoPagado;
    }

    if (productoKey && cantidad > 0) {
      pagoTotals.productos = pagoTotals.productos || new Map();
      pagoTotals.productos.set(productoKey, (pagoTotals.productos.get(productoKey) || 0) + cantidad);
    }
  });

  return {
    totalUnidades,
    totalMontoNet,
    totalCredito,
    pagoTotals
  };
}

function computeVetsCommissionsByVeterinario(data, range, recaudoVetsMap) {
  const totals = new Map();

  data.forEach((item) => {
    const date = new Date(item.created_at);
    if (isNaN(date.getTime())) return;
    if (date < range.start || date >= range.end) return;

    const confirmada = Array.isArray(item.ventas_kv_confirmadas) && item.ventas_kv_confirmadas.length
      ? item.ventas_kv_confirmadas[0]
      : null;
    if (!confirmada) return;

    const metodo = normalizePago(confirmada.metodo_pago);
    const veterinario = String(item.veterinario || 'Sin veterinario').trim() || 'Sin veterinario';
    let monto = 0;
    if (metodo === 'credito') {
      const abono = recaudoVetsMap?.get(confirmada.id) || 0;
      monto = (Number(confirmada.monto_pagado) || 0) + abono;
    } else {
      monto = Number(confirmada.monto_pagado) || 0;
    }
    if (monto > 0) {
      totals.set(veterinario, (totals.get(veterinario) || 0) + monto);
    }
  });

  return Array.from(totals.entries())
    .map(([name, totalNet]) => ({
      name,
      totalNet,
      commission: totalNet * getVetsCommissionRate(totalNet)
    }))
    .sort((a, b) => b.commission - a.commission);
}

function buildVentasMonthSeries(data, year) {
  const counts = Array.from({ length: 12 }, () => 0);

  data.forEach((item) => {
    const fecha = new Date(item.created_at);
    if (isNaN(fecha.getTime())) return;
    if (fecha.getFullYear() !== year) return;
    const confirmada = Array.isArray(item.ventas_kv_confirmadas) && item.ventas_kv_confirmadas.length
      ? item.ventas_kv_confirmadas[0]
      : null;
    if (!confirmada) return;
    counts[fecha.getMonth()] += Number(confirmada.cantidad) || 0;
  });

  return counts;
}

function computeAdvisorCommissions(preventas, advisors, range) {
  const advisorMap = new Map(advisors.map((advisor) => [advisor.id, advisor.nombre_apellido || advisor.email || 'Asesor']));
  const totals = new Map();

  preventas.forEach((item) => {
    if (!isConfirmada(item.estado_preventa)) return;
    const fecha = new Date(item.fechapreventa);
    if (isNaN(fecha.getTime())) return;
    if (fecha < range.start || fecha >= range.end) return;

    const advisorId = item.agente_id || 'sin_asignar';
    let total = totals.get(advisorId) || 0;

    for (let i = 1; i <= 4; i += 1) {
      const producto = item[`produc_${i}`];
      const cantidad = Number(item[`cant_${i}`]) || 0;
      if (!producto || cantidad <= 0) continue;
      const rate = productMap.get(normalizeValue(producto))?.rate || 0;
      total += rate * cantidad;
    }

    totals.set(advisorId, total);
  });

  const entries = Array.from(totals.entries())
    .map(([id, total]) => ({
      id,
      name: advisorMap.get(id) || 'Sin asignar',
      total
    }))
    .sort((a, b) => b.total - a.total);

  return entries;
}

async function loadMetrics(token, rangeOptions = {}) {
  const range = buildRange(rangeOptions);
  const periodLabel = getPeriodLabel(rangeOptions);
  const allTimeRange = {
    start: new Date(0),
    end: new Date(8640000000000000)
  };

  try {
    const preventasParams = new URLSearchParams();
    preventasParams.append('all', 'true');

    const [preventasResponse, ventasResponse, advisorsResponse, recaudosResponse, recaudosVetsResponse] = await Promise.all([
      fetch(`${PREVENTAS_API}?${preventasParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      fetch(VENTAS_API, {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      fetch(ADVISORS_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      fetch(RECAUDO_API_BASE_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
      }),
      fetch(RECAUDO_VETS_API_BASE_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
    ]);

    const preventasData = await preventasResponse.json();
    const ventasData = await ventasResponse.json();
    const advisorsData = await advisorsResponse.json();
    const recaudosData = await recaudosResponse.json();
    const recaudosVetsData = await recaudosVetsResponse.json();

    if (!preventasResponse.ok) {
      console.error('Error al cargar preventas:', preventasData);
      return;
    }
    if (!ventasResponse.ok) {
      console.error('Error al cargar ventas:', ventasData);
      return;
    }
    if (!advisorsResponse.ok) {
      console.error('Error al cargar asesores:', advisorsData);
      return;
    }

    if (!recaudosResponse.ok) {
      console.error('Error al cargar recaudos:', recaudosData);
    }
    if (!recaudosVetsResponse.ok) {
      console.error('Error al cargar recaudos vets:', recaudosVetsData);
    }

    const pazYSalvoMap = recaudosResponse.ok ? buildPazYSalvoMap(recaudosData) : new Map();
      const recaudoVetsMapAll = recaudosVetsResponse.ok ? buildRecaudoVetsMap(recaudosVetsData, allTimeRange) : new Map();
      const recaudoVetsMapRange = recaudosVetsResponse.ok ? buildRecaudoVetsMap(recaudosVetsData, range) : new Map();
      const preventasMetrics = computePreventasMetrics(preventasData, allTimeRange, pazYSalvoMap);
      const ventasMetrics = computeVentasMetrics(ventasData, allTimeRange);

    document.getElementById('metric-comisiones').textContent = formatCurrency(preventasMetrics.totalComisionesNetas || 0);
    document.getElementById('metric-unidades').textContent = preventasMetrics.totalUnidades || 0;
    document.getElementById('metric-retenidas').textContent = formatCurrency(preventasMetrics.totalRetenidas || 0);

    document.getElementById('metric-ventas-unidades').textContent = ventasMetrics.totalUnidades || 0;
    document.getElementById('metric-ventas-monto').textContent = formatCurrency(ventasMetrics.totalMontoNet || 0);
    document.getElementById('metric-ventas-credito').textContent = formatCurrency(ventasMetrics.totalCredito || 0);
    const useRangeForCommissions = Boolean(rangeOptions.month || rangeOptions.preset);
    const commissionRange = useRangeForCommissions ? range : allTimeRange;
      const ventasComisionesTotal = computeVetsCommissionsTotal(ventasData, commissionRange);
    document.getElementById('metric-ventas-comisiones').textContent = formatCurrency(ventasComisionesTotal || 0);

    const preventasDayChart = document.getElementById('chart-preventas-day');
    const preventasDaySeries = buildDaySeries(
      range,
      preventasData,
      (item) => new Date(item.fechapreventa),
      (item) => {
        if (!isConfirmada(item.estado_preventa)) return 0;
        let unidades = 0;
        for (let i = 1; i <= 4; i += 1) {
          unidades += Number(item[`cant_${i}`]) || 0;
        }
        return unidades;
      }
    );
    renderBars(preventasDayChart, preventasDaySeries.labels, preventasDaySeries.counts, { barClass: 'preventas' });

    const ventasDayChart = document.getElementById('chart-ventas-day');
    const ventasDaySeries = buildDaySeries(
      range,
      ventasData,
      (item) => new Date(item.created_at),
      (item) => {
        const confirmada = Array.isArray(item.ventas_kv_confirmadas) && item.ventas_kv_confirmadas.length
          ? item.ventas_kv_confirmadas[0]
          : null;
        return confirmada ? Number(confirmada.cantidad) || 0 : 0;
      }
    );
    renderBars(ventasDayChart, ventasDaySeries.labels, ventasDaySeries.counts, { barClass: 'vets' });

    const preventasMonthChart = document.getElementById('chart-preventas-month');
    renderBars(preventasMonthChart, monthLabels, buildMonthSeries(preventasData, range.start.getFullYear()), { barClass: 'preventas' });

    const ventasMonthChart = document.getElementById('chart-ventas-month');
    renderBars(ventasMonthChart, monthLabels, buildVentasMonthSeries(ventasData, range.start.getFullYear()), { barClass: 'vets' });

    const productContainer = document.getElementById('chart-products');
    const ventasProductos = ventasMetrics.pagoTotals.productos || new Map();
    const productLabels = Array.from(new Set([
      ...preventasMetrics.unidadesPorProducto.map((item) => item.producto),
      ...Array.from(ventasProductos.keys())
    ]));

    if (productLabels.length) {
      productContainer.classList.remove('empty-state');
      const preventasValues = productLabels.map((label) => {
        const match = preventasMetrics.unidadesPorProducto.find((item) => item.producto === label);
        return match ? match.unidades : 0;
      });
      const ventasValues = productLabels.map((label) => ventasProductos.get(label) || 0);
      productContainer.innerHTML = '';
      renderGroupedBars(productContainer, productLabels, [
        { name: 'Preventas', values: preventasValues, className: 'preventas' },
        { name: 'Vets', values: ventasValues, className: 'vets' }
      ]);
      const legend = document.createElement('div');
      legend.className = 'grouped-legend';
      legend.innerHTML = `
        <span class="legend-pill"><span class="legend-dot preventas"></span>Preventas</span>
        <span class="legend-pill"><span class="legend-dot vets"></span>Vets</span>
      `;
      productContainer.appendChild(legend);
    } else {
      productContainer.classList.add('empty-state');
      productContainer.textContent = 'Sin datos de productos.';
    }

    const preventasCommissions = computeAdvisorCommissions(preventasData, advisorsData, range);
    const vetsCommissions = computeVetsCommissionsByVeterinario(ventasData, range, recaudoVetsMapRange);
    const preventasCommissionsAll = computeAdvisorCommissions(preventasData, advisorsData, allTimeRange);
    const vetsCommissionsAll = computeVetsCommissionsByVeterinario(ventasData, allTimeRange, recaudoVetsMapAll);
    const preventasChart = document.getElementById('chart-commissions-preventas');
    const vetsChart = document.getElementById('chart-commissions-vets');
    const preventasAllChart = document.getElementById('chart-commissions-preventas-all');
    const vetsAllChart = document.getElementById('chart-commissions-vets-all');

    if (preventasCommissions.length) {
      preventasChart.classList.remove('empty-state');
      renderBars(
        preventasChart,
        preventasCommissions.map((item) => item.name),
        preventasCommissions.map((item) => item.total),
        { barClass: 'preventas', valueFormatter: formatCurrency }
      );
    } else if (preventasChart) {
      preventasChart.classList.add('empty-state');
      preventasChart.textContent = 'Sin comisiones de preventas.';
    }

    if (vetsCommissions.length) {
      vetsChart.classList.remove('empty-state');
      renderBars(
        vetsChart,
        vetsCommissions.map((item) => item.name),
        vetsCommissions.map((item) => item.commission),
        { barClass: 'vets', valueFormatter: formatCurrency }
      );
    } else if (vetsChart) {
      vetsChart.classList.add('empty-state');
      vetsChart.textContent = 'Sin comisiones de Vets.';
    }

    if (preventasCommissionsAll.length) {
      preventasAllChart.classList.remove('empty-state');
      renderBars(
        preventasAllChart,
        preventasCommissionsAll.map((item) => item.name),
        preventasCommissionsAll.map((item) => item.total),
        { barClass: 'preventas', valueFormatter: formatCurrency }
      );
    } else if (preventasAllChart) {
      preventasAllChart.classList.add('empty-state');
      preventasAllChart.textContent = 'Sin comisiones historicas de preventas.';
    }

    if (vetsCommissionsAll.length) {
      vetsAllChart.classList.remove('empty-state');
      renderBars(
        vetsAllChart,
        vetsCommissionsAll.map((item) => item.name),
        vetsCommissionsAll.map((item) => item.commission),
        { barClass: 'vets', valueFormatter: formatCurrency }
      );
    } else if (vetsAllChart) {
      vetsAllChart.classList.add('empty-state');
      vetsAllChart.textContent = 'Sin comisiones historicas de Vets.';
    }

    const paymentContainer = document.getElementById('chart-payment');
    const paymentLabels = ['De contado', 'Contra entrega', 'Credito'];
      const paymentValues = [
        ventasMetrics.pagoTotals.contado || 0,
        ventasMetrics.pagoTotals.contraentrega || 0,
        ventasMetrics.pagoTotals.credito || 0
      ];
    if (paymentValues.some((value) => value > 0)) {
      paymentContainer.classList.remove('empty-state');
      const barChart = document.createElement('div');
      barChart.className = 'bar-chart';
      paymentContainer.innerHTML = '';
      paymentContainer.appendChild(barChart);
      renderBars(barChart, paymentLabels, paymentValues, { valueFormatter: formatCurrency, barClass: 'vets' });
    } else {
      paymentContainer.classList.add('empty-state');
      paymentContainer.textContent = 'Sin ventas confirmadas.';
    }

    document.getElementById('period-subtitle').textContent = `Resumen - ${periodLabel}`;
    document.getElementById('chart-preventas-label').textContent = periodLabel;
    document.getElementById('chart-ventas-label').textContent = periodLabel;
    document.getElementById('chart-preventas-year').textContent = range.start.getFullYear();
    document.getElementById('chart-ventas-year').textContent = range.start.getFullYear();
    document.getElementById('chart-asesores-label').textContent = periodLabel;
  } catch (error) {
    console.error('Error al cargar rendimiento general:', error);
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

  const monthInput = document.getElementById('filter-month');
  const btnApply = document.getElementById('btn-apply-month');
  const btnClear = document.getElementById('btn-clear');
  const presetButtons = document.querySelectorAll('[data-preset]');

  function setActivePreset(activeButton) {
    presetButtons.forEach((btn) => btn.classList.remove('active'));
    if (activeButton) activeButton.classList.add('active');
  }

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
