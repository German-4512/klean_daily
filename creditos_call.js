const API_BASE_URL = 'http://localhost:3001/api/creditos_kv';
const AUTH_BASE_URL = 'http://localhost:3001/api/auth';

function normalizeValue(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z]/g, '');
}

function formatDateTime(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleString('es-CO');
}

function getDaysSince(dateValue) {
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return null;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = todayStart - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

function getCobroStatus(dateValue) {
  const days = getDaysSince(dateValue);
  if (days === null) {
    return { label: 'N/A', className: 'cobro-unknown' };
  }
  if (days <= 16) return { label: 'A tiempo', className: 'cobro-ok' };
  if (days <= 24) return { label: 'Pronto Vence', className: 'cobro-soon' };
  return { label: 'Vencido', className: 'cobro-late' };
}

function isConfirmada(value) {
  const normalized = normalizeValue(value);
  return normalized === 'confirmada' || normalized === 'confirmado';
}

function isCredito(value) {
  return normalizeValue(value) === 'credito';
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

  return 'Todos';
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
    const isDataVentas = role === 'datos y ventas klean vet';

    if (!isAdmin && !isCallCenter && !isDataVentas) {
      window.location.href = 'inicio_sesion.html';
      return null;
    }

    return token;
  } catch (error) {
    window.location.href = 'inicio_sesion.html';
    return null;
  }
}

async function loadCreditos(token, rangeOptions = {}, estadoCredito = '') {
  const tbody = document.getElementById('creditos-body');
  tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Cargando creditos...</td></tr>';

  try {
    const response = await fetch(API_BASE_URL, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    if (!response.ok) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">Error: ${data.message || 'No se pudo cargar.'}</td></tr>`;
      return;
    }

    const rows = [];
    const hasRange = Boolean(rangeOptions.month || rangeOptions.preset);
    const range = hasRange ? buildRange(rangeOptions) : null;
    data.forEach((item) => {
      if (!isConfirmada(item.estado_preventa)) return;
      if (!isCredito(item.metodo_pago)) return;

      if (hasRange) {
        const fecha = new Date(item.fechapreventa);
        const inRange = !isNaN(fecha.getTime()) && fecha >= range.start && fecha < range.end;
        if (!inRange) return;
      }

      const estadoActual = item.estado_credito || 'P. Pago';
      if (estadoCredito && normalizeValue(estadoActual) !== normalizeValue(estadoCredito)) return;

      rows.push({
        id: item.id,
        date: item.fechapreventa,
        numDoc: item.num_doc || 'N/A',
        telContacto: item.tel_contacto || item.telContacto || 'N/A',
        tutor: item.nombre_tutor || 'N/A',
        saldoPendiente: item.saldo_pendiente,
        estadoCredito: estadoActual
      });
    });

    tbody.innerHTML = '';
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No hay creditos confirmados para el filtro seleccionado.</td></tr>';
      return;
    }

    rows.forEach((row) => {
      const tr = document.createElement('tr');
      const saldoValue = row.saldoPendiente !== null && row.saldoPendiente !== undefined
        ? String(row.saldoPendiente)
        : '0';
      const cobroStatus = getCobroStatus(row.date);

      tr.innerHTML = `
        <td>${formatDateTime(row.date)}</td>
        <td>${row.numDoc}</td>
        <td>${row.telContacto}</td>
        <td>${row.tutor}</td>
        <td><span class="cobro-badge ${cobroStatus.className}">${cobroStatus.label}</span></td>
        <td class="cell-text">${saldoValue}</td>
        <td class="cell-text">${row.estadoCredito}</td>
      `;
      tbody.appendChild(tr);
    });

    const periodLabel = getPeriodLabel(rangeOptions);
    document.getElementById('table-period-label').textContent =
      `Ventas confirmadas con metodo de pago en credito - ${periodLabel}`;
    document.getElementById('period-subtitle').textContent =
      `Registros en credito confirmados - ${periodLabel}`;
  } catch (error) {
    console.error('Error al cargar creditos:', error);
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Error de conexion.</td></tr>';
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
  const estadoSelect = document.getElementById('filter-estado');
  const presetButtons = document.querySelectorAll('[data-preset]');

  function setActivePreset(activeButton) {
    presetButtons.forEach((btn) => btn.classList.remove('active'));
    if (activeButton) activeButton.classList.add('active');
  }

  btnApply.addEventListener('click', () => {
    const monthValue = monthInput.value;
    setActivePreset(null);
    loadCreditos(token, { month: monthValue }, estadoSelect.value);
  });

  btnClear.addEventListener('click', () => {
    monthInput.value = '';
    estadoSelect.value = '';
    setActivePreset(null);
    loadCreditos(token, {}, '');
  });

  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      setActivePreset(btn);
      monthInput.value = '';
      loadCreditos(token, { preset }, estadoSelect.value);
    });
  });

  estadoSelect.addEventListener('change', () => {
    loadCreditos(token, { month: monthInput.value || '' }, estadoSelect.value);
  });

  loadCreditos(token, {}, estadoSelect.value);
});
