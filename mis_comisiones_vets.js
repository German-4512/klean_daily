const VENTAS_API = '/api/ventas_tutores';
const CREDITOS_VETS_API = '/api/creditos_vets';
const RECAUDO_VETS_API = '/api/recaudo_vets';
const AUTH_BASE_URL = '/api/auth';

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

function formatUnits(value) {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue)) return '0';
  if (Math.abs(numberValue - Math.round(numberValue)) < 0.001) return String(Math.round(numberValue));
  return numberValue.toFixed(2);
}

function formatPercent(value) {
  const numberValue = Number(value || 0) * 100;
  if (!Number.isFinite(numberValue)) return '0%';
  const text = numberValue.toFixed(1).replace(/\.0$/, '');
  return `${text}%`;
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

function buildRecaudoVetsMap(recaudos, range) {
  const map = new Map();
  (recaudos || []).forEach((item) => {
    const id = item.venta_confirmada_id;
    if (!id) return;
    const key = String(id);
    const monto = Number(item.monto) || 0;
    const pagoInicial = Number(item.pago_inicial) || 0;
    const fechaMonto = new Date(item.fecha_recaudo || item.created_at);
    const fechaPagoInicial = new Date(item.fecha_pago_inicial || item.fecha_recaudo || item.created_at);

    const addIfInRange = (amount, date) => {
      if (amount <= 0) return;
      if (range) {
        if (isNaN(date.getTime())) return;
        if (date < range.start || date >= range.end) return;
      }
      map.set(key, (map.get(key) || 0) + amount);
    };

    addIfInRange(monto, fechaMonto);
    addIfInRange(pagoInicial, fechaPagoInicial);
  });
  return map;
}

function buildCreditMap(creditos, range) {
  const map = new Map();
  (creditos || []).forEach((item) => {
    if (!isCredito(item.metodo_pago)) return;
    const estado = normalizeStatus(item.estado_credito);
    if (estado === 'pazysalvo') return;
    if (range) {
      const fecha = new Date(item.fecha_venta || item.created_at);
      if (isNaN(fecha.getTime())) return;
      if (fecha < range.start || fecha >= range.end) return;
    }
    const id = item.venta_confirmada_id;
    if (!id) return;
    const saldo = Number(item.saldo_pendiente) || 0;
    if (saldo <= 0) return;
    const key = String(id);
    map.set(key, (map.get(key) || 0) + saldo);
  });
  return map;
}

function resolveVetName({ user, profile }) {
  return profile?.medico_veterinario || profile?.nombre_apellido || user?.email || '';
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

function getProductName(item, confirmada) {
  return String(confirmada?.producto || item.dim_producto?.nombre_2 || item.concentracion || '').trim();
}

function getVetsProductType(item, confirmada) {
  const tipo = normalizeValue(item.dim_producto?.tipo_producto || '');
  if (tipo.includes('cbd')) return 'cbd';
  if (tipo.includes('plus')) return 'plus';

  const producto = getProductName(item, confirmada);
  const normalized = normalizeValue(producto);
  if (CBD_PRODUCTS.has(normalized)) return 'cbd';
  if (PLUS_PRODUCTS.has(normalized)) return 'plus';
  return '';
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
    const isAdmin = role === 'admin';
    const isVeterinario = role === 'veterinario';

    if (!isAdmin && !isVeterinario) {
      window.location.href = 'inicio_sesion.html';
      return null;
    }

    return {
      token,
      user: data.user || null,
      profile: data.profile || null,
      isAdmin
    };
  } catch (error) {
    window.location.href = 'inicio_sesion.html';
    return null;
  }
}

async function loadComisiones(context, rangeOptions = {}) {
  const tbody = document.getElementById('comisiones-body');
  tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Cargando comisiones...</td></tr>';

  const range = buildRange(rangeOptions);
  const periodLabel = getPeriodLabel(rangeOptions);

  try {
    const [ventasResponse, creditosResponse, recaudosResponse] = await Promise.all([
      fetch(VENTAS_API, { headers: { 'Authorization': `Bearer ${context.token}` } }),
      fetch(CREDITOS_VETS_API, { headers: { 'Authorization': `Bearer ${context.token}` } }),
      fetch(RECAUDO_VETS_API, { headers: { 'Authorization': `Bearer ${context.token}` } })
    ]);

    const ventasData = await ventasResponse.json();
    const creditosData = await creditosResponse.json();
    const recaudosData = await recaudosResponse.json();

    if (!ventasResponse.ok) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Error al cargar ventas.</td></tr>';
      return;
    }
    if (!creditosResponse.ok) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Error al cargar creditos.</td></tr>';
      return;
    }
    if (!recaudosResponse.ok) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Error al cargar recaudos.</td></tr>';
      return;
    }

    const vetName = resolveVetName(context);
    const selectedVet = context.isAdmin ? '' : normalizeValue(vetName);
    const scopedVentas = context.isAdmin
      ? ventasData
      : ventasData.filter((item) => matchesVet(item.veterinario, selectedVet));
    const scopedCreditos = context.isAdmin
      ? creditosData
      : creditosData.filter((item) => matchesVet(item.veterinario, selectedVet));

    const recaudoMapAll = buildRecaudoVetsMap(recaudosData, null);
    const recaudoMapRange = buildRecaudoVetsMap(recaudosData, range);
    const creditMapAll = buildCreditMap(scopedCreditos, null);
    const creditMapRange = buildCreditMap(scopedCreditos, range);

    let cbdPaidRange = 0;
    let cbdPaidAll = 0;
    let cbdCreditRange = 0;
    let cbdCreditAll = 0;
    let plusPaidUnitsRange = 0;
    let plusPaidUnitsAll = 0;
    let plusCreditUnitsRange = 0;
    let plusCreditUnitsAll = 0;
    const detailRows = [];

    scopedVentas.forEach((item) => {
      const confirmada = Array.isArray(item.ventas_kv_confirmadas) && item.ventas_kv_confirmadas.length
        ? item.ventas_kv_confirmadas[0]
        : null;
      if (!confirmada) return;

      const saleDate = new Date(item.created_at);
      const saleInRange = !isNaN(saleDate.getTime()) && saleDate >= range.start && saleDate < range.end;
      const paymentDate = new Date(confirmada.created_at || item.created_at);
      const paymentInRange = !isNaN(paymentDate.getTime()) && paymentDate >= range.start && paymentDate < range.end;
      const id = String(confirmada.id);
      const montoPagado = Number(confirmada.monto_pagado) || 0;
      const montoVenta = Number(confirmada.monto_venta) || 0;
      const recaudoRange = recaudoMapRange.get(id) || 0;
      const recaudoAll = recaudoMapAll.get(id) || 0;
      const metodo = normalizeStatus(confirmada.metodo_pago);
      const isCreditSale = metodo === 'credito';
      const paidRange = isCreditSale ? recaudoRange : (paymentInRange ? montoPagado : 0);
      const paidAll = isCreditSale ? recaudoAll : (montoPagado + recaudoAll);
      const creditRange = creditMapRange.get(id) || 0;
      const creditAll = creditMapAll.get(id) || 0;
      const tipo = getVetsProductType(item, confirmada);
      const cantidad = Number(confirmada.cantidad) || 0;

      if (tipo === 'cbd') {
        cbdPaidRange += paidRange;
        cbdPaidAll += paidAll;
        if (saleInRange) {
          cbdCreditRange += creditRange;
        }
        cbdCreditAll += creditAll;
      } else if (tipo === 'plus') {
        const ratioRange = montoVenta > 0 ? Math.min(paidRange / montoVenta, 1) : (paidRange > 0 ? 1 : 0);
        const ratioAll = montoVenta > 0 ? Math.min(paidAll / montoVenta, 1) : (paidAll > 0 ? 1 : 0);
        const paidUnitsRange = cantidad * ratioRange;
        const paidUnitsAll = cantidad * ratioAll;
        plusPaidUnitsRange += paidUnitsRange;
        plusPaidUnitsAll += paidUnitsAll;
        if (saleInRange) {
          plusCreditUnitsRange += Math.max(cantidad - paidUnitsRange, 0);
        }
        plusCreditUnitsAll += Math.max(cantidad - paidUnitsAll, 0);
      }

      if (saleInRange || paidRange > 0) {
        detailRows.push({
          item,
          confirmada,
          tipo,
          cantidad,
          montoVenta,
          paidRange,
          creditRange,
          saleInRange
        });
      }
    });

    const cbdRateRange = getVetsCommissionRate(cbdPaidRange);
    const cbdRateAll = getVetsCommissionRate(cbdPaidAll);

    const totalPeriodo = (cbdPaidRange * cbdRateRange) + (plusPaidUnitsRange * PLUS_RATE);
    const retenidasPeriodo = (cbdCreditRange * cbdRateRange) + (plusCreditUnitsRange * PLUS_RATE);
    const totalGeneral = (cbdPaidAll * cbdRateAll) + (plusPaidUnitsAll * PLUS_RATE);
    const retenidasGeneral = (cbdCreditAll * cbdRateAll) + (plusCreditUnitsAll * PLUS_RATE);

    document.getElementById('total-mes').textContent = formatCurrency(totalPeriodo || 0);
    document.getElementById('retenidas-mes').textContent = formatCurrency(retenidasPeriodo || 0);
    document.getElementById('total-general').textContent = formatCurrency(totalGeneral || 0);
    document.getElementById('retenidas-general').textContent = formatCurrency(retenidasGeneral || 0);

    document.getElementById('period-subtitle').textContent = `Resumen de comisiones - ${periodLabel}`;
    document.getElementById('table-month-label').textContent = periodLabel;

    if (!detailRows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Sin comisiones en el periodo.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    detailRows.forEach(({ item, confirmada, tipo, cantidad, montoVenta, paidRange, creditRange, saleInRange }) => {
      const producto = getProductName(item, confirmada) || 'Sin producto';
      const numDoc = item.cedula_cliente || 'N/A';
      const ratioRange = montoVenta > 0 ? Math.min(paidRange / montoVenta, 1) : (paidRange > 0 ? 1 : 0);
      const paidUnits = cantidad * ratioRange;
      const creditUnits = saleInRange ? Math.max(cantidad - paidUnits, 0) : 0;
      let rateDisplay = '-';
      let paidTotal = 0;
      let creditTotal = 0;

      if (tipo === 'cbd') {
        rateDisplay = formatPercent(cbdRateRange);
        paidTotal = paidRange * cbdRateRange;
        creditTotal = saleInRange ? creditRange * cbdRateRange : 0;
      } else if (tipo === 'plus') {
        rateDisplay = formatCurrency(PLUS_RATE);
        paidTotal = paidUnits * PLUS_RATE;
        creditTotal = creditUnits * PLUS_RATE;
      }

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${numDoc}</td>
        <td>${producto}</td>
        <td>${formatUnits(paidUnits)}</td>
        <td>${formatUnits(creditUnits)}</td>
        <td>${rateDisplay}</td>
        <td>${formatCurrency(paidTotal)}</td>
        <td>${formatCurrency(creditTotal)}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error al cargar comisiones vets:', error);
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Error de conexion.</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const context = await verifyAccess();
  if (!context) return;

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
    loadComisiones(context, { month: monthValue });
  });

  btnClear.addEventListener('click', () => {
    monthInput.value = '';
    setActivePreset(null);
    loadComisiones(context, {});
  });

  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      setActivePreset(btn);
      monthInput.value = '';
      loadComisiones(context, { preset });
    });
  });

  loadComisiones(context, {});
});
