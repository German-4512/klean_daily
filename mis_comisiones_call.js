const API_BASE_URL = '/api/preventascall';
const RECAUDO_API_BASE_URL = '/api/recaudo_call';
const AUTH_BASE_URL = '/api/auth';

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

function normalizeValue(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function formatCurrency(value) {
  const numberValue = Number(value || 0);
  return numberValue.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  });
}

function isConfirmada(value) {
  const normalized = normalizeValue(value).replace(/[^a-z]/g, '');
  return normalized === 'confirmada' || normalized === 'confirmado';
}

function isCredito(value) {
  return normalizeValue(value) === normalizeValue('Credito');
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
    const isAdmin = role === 'admin';
    const isCallCenter = role === 'asesor comercial callcenter' && estado === 'activo';

    if (!isAdmin && !isCallCenter) {
      window.location.href = 'inicio_sesion.html';
      return null;
    }

    return token;
  } catch (error) {
    window.location.href = 'inicio_sesion.html';
    return null;
  }
}

function initProductStats() {
  const stats = {};
  PRODUCTS.forEach((item) => {
    stats[item.name] = {
      rate: item.rate,
      paidUnits: 0,
      creditUnits: 0,
      paidTotal: 0,
      creditTotal: 0
    };
  });
  return stats;
}

function isValidDate(value) {
  return value instanceof Date && !isNaN(value.getTime());
}

function isSameMonth(dateA, dateB) {
  if (!isValidDate(dateA) || !isValidDate(dateB)) return false;
  return dateA.getFullYear() === dateB.getFullYear() && dateA.getMonth() === dateB.getMonth();
}

function buildPazYSalvoMap(recaudos) {
  const map = new Map();
  recaudos.forEach((item) => {
    const tipo = normalizeValue(item.tipo_recaudo).replace(/[^a-z]/g, '');
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

async function loadComisiones(token, rangeOptions = {}) {
  const tbody = document.getElementById('comisiones-body');
  tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Cargando comisiones...</td></tr>';
  const isMonthRange = !rangeOptions.preset;

  try {
    const [preventasResponse, recaudosResponse] = await Promise.all([
      fetch(API_BASE_URL, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(RECAUDO_API_BASE_URL, { headers: { 'Authorization': `Bearer ${token}` } })
    ]);

    const data = await preventasResponse.json();
    const recaudos = await recaudosResponse.json();

    if (!preventasResponse.ok) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Error: ${data.message || 'No se pudo cargar.'}</td></tr>`;
      return;
    }
    if (!recaudosResponse.ok) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Error: ${recaudos.message || 'No se pudo cargar recaudos.'}</td></tr>`;
      return;
    }

    const periodStats = initProductStats();
    let totalPeriodo = 0;
    let retenidasPeriodo = 0;
    let retenidasGeneral = 0;
    let totalGeneral = 0;
    const range = buildRange(rangeOptions);
    const detailRows = [];
    const pazYSalvoMap = buildPazYSalvoMap(recaudos || []);

    data.forEach((item) => {
      if (!isConfirmada(item.estado_preventa)) return;

      const credito = isCredito(item.metodo_pago);
      const fecha = new Date(item.fechapreventa);
      const inRange = !isNaN(fecha.getTime()) && fecha >= range.start && fecha < range.end;
      const pazYSalvoInfo = credito ? pazYSalvoMap.get(item.id) : null;
      const fechaRecaudo = pazYSalvoInfo ? pazYSalvoInfo.fecha : null;
      const hasPazYSalvo = isValidDate(fechaRecaudo);
      const inRangeRecaudo = hasPazYSalvo && fechaRecaudo >= range.start && fechaRecaudo < range.end;
      const sameMonthPazYSalvo = hasPazYSalvo && isSameMonth(fechaRecaudo, fecha);

      for (let i = 1; i <= 4; i += 1) {
        const rawProduct = item[`produc_${i}`];
        const qty = Number(item[`cant_${i}`]) || 0;
        if (!rawProduct || qty <= 0) continue;

        const normalized = normalizeValue(rawProduct);
        const productData = productMap.get(normalized);
        if (!productData) continue;

        const rate = productData.rate;
        const subtotal = rate * qty;

        if (credito) {
          if (hasPazYSalvo) {
            totalGeneral += subtotal;
            if (inRangeRecaudo || (isMonthRange && inRange && sameMonthPazYSalvo)) {
              const stats = periodStats[productData.name];
              stats.paidUnits += qty;
              stats.paidTotal += subtotal;
              totalPeriodo += subtotal;
              detailRows.push({
                numDoc: item.num_doc || 'N/A',
                product: productData.name,
                paidUnits: qty,
                creditUnits: 0,
                rate,
                paidTotal: subtotal,
                creditTotal: 0
              });
            }
          } else {
            retenidasGeneral += subtotal;
            if (inRange) {
              const stats = periodStats[productData.name];
              stats.creditUnits += qty;
              stats.creditTotal += subtotal;
              retenidasPeriodo += subtotal;
              detailRows.push({
                numDoc: item.num_doc || 'N/A',
                product: productData.name,
                paidUnits: 0,
                creditUnits: qty,
                rate,
                paidTotal: 0,
                creditTotal: subtotal
              });
            }
          }
        } else {
          totalGeneral += subtotal;
          if (inRange) {
            const stats = periodStats[productData.name];
            stats.paidUnits += qty;
            stats.paidTotal += subtotal;
            totalPeriodo += subtotal;
            detailRows.push({
              numDoc: item.num_doc || 'N/A',
              product: productData.name,
              paidUnits: qty,
              creditUnits: 0,
              rate,
              paidTotal: subtotal,
              creditTotal: 0
            });
          }
        }
      }
    });

    document.getElementById('total-mes').textContent = formatCurrency(totalPeriodo);
    document.getElementById('retenidas-mes').textContent = formatCurrency(retenidasPeriodo);
    document.getElementById('retenidas-general').textContent = formatCurrency(retenidasGeneral);
    document.getElementById('total-general').textContent = formatCurrency(totalGeneral);

    tbody.innerHTML = '';
    if (!detailRows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Sin datos para el filtro seleccionado.</td></tr>';
    } else {
      detailRows.forEach((detail) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${detail.numDoc}</td>
          <td>${detail.product}</td>
          <td>${detail.paidUnits}</td>
          <td>${detail.creditUnits}</td>
          <td>${formatCurrency(detail.rate)}</td>
          <td>${formatCurrency(detail.paidTotal)}</td>
          <td>${formatCurrency(detail.creditTotal)}</td>
        `;
        tbody.appendChild(row);
      });
    }

    const periodLabel = getPeriodLabel(rangeOptions);
    document.getElementById('table-month-label').textContent = periodLabel;
    document.getElementById('period-subtitle').textContent = `Resumen de comisiones confirmadas - ${periodLabel}`;
  } catch (error) {
    console.error('Error al cargar comisiones:', error);
    tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Error de conexion.</td></tr>';
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
    loadComisiones(token, { month: monthValue });
  });

  btnClear.addEventListener('click', () => {
    monthInput.value = '';
    setActivePreset(null);
    loadComisiones(token, {});
  });

  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      setActivePreset(btn);
      monthInput.value = '';
      loadComisiones(token, { preset });
    });
  });

  loadComisiones(token, {});
});
