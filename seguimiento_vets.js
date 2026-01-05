const VENTAS_API = 'http://localhost:3001/api/ventas_tutores';
const SEGUIMIENTOS_API = 'http://localhost:3001/api/seguimientos_vets';
const SEGUIMIENTOS_45_API = 'http://localhost:3001/api/seguimientos_vets_45';
const AUTH_BASE_URL = 'http://localhost:3001/api/auth';

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_DELAY_MS = 3 * 60 * 1000;
const FOLLOWUP_30_DAYS = 30;
const FOLLOWUP_45_DAYS = 45;

function normalizeValue(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function getLatestFollowupRecord(followups, confirmadaId, seguimientoDias) {
  const normalizedDias = normalizeValue(seguimientoDias);
  return followups.find((item) =>
    item.venta_confirmada_id === confirmadaId &&
    normalizeValue(item.seguimiento_dias) === normalizedDias
  ) || null;
}

function isReminderActive(followups, confirmadaId, seguimientoDias) {
  const record = getLatestFollowupRecord(followups, confirmadaId, seguimientoDias);
  if (!record?.recordatorio_sg) return false;
  if (normalizeValue(record.estado) === normalizeValue('Finalizado')) return false;
  const timestamp = new Date(record.recordatorio_sg).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp >= REMINDER_DELAY_MS;
}

function resolveVetName({ user, profile }) {
  return profile?.medico_veterinario || profile?.nombre_apellido || user?.email || '';
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

function pickLatestConfirmada(confirmadas) {
  return confirmadas
    .filter((item) => item?.created_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || confirmadas[0];
}

function buildSeguimientoRows(ventasData, context) {
  const vetName = resolveVetName(context);
  const normalizedVet = normalizeValue(vetName);
  const grouped = new Map();

  ventasData.forEach((venta) => {
    const confirmadas = Array.isArray(venta.ventas_kv_confirmadas) ? venta.ventas_kv_confirmadas : [];
    if (!confirmadas.length) return;

    if (!context.isAdmin) {
      const ventaVet = normalizeValue(venta.veterinario || '');
      if (!ventaVet || ventaVet !== normalizedVet) {
        return;
      }
    }

    const latestConfirmada = pickLatestConfirmada(confirmadas);
    const cedula = venta.cedula_cliente || 'sin-cedula';
    const current = grouped.get(cedula);

    if (!current || new Date(latestConfirmada.created_at) > new Date(current.confirmada.created_at)) {
      grouped.set(cedula, {
        venta,
        confirmada: latestConfirmada
      });
    }
  });

  return Array.from(grouped.values());
}

function buildProgressStatus(followups, confirmadaId) {
  const records = followups.filter((item) => item.venta_confirmada_id === confirmadaId);
  const isFinalized = (value) => normalizeValue(value) === normalizeValue('Finalizado');
  const isFallecido = (value) => normalizeValue(value) === normalizeValue('Fallecido');
  const hasFallecido = records.some((item) => isFallecido(item.contactar_cliente));
  const has30 = records.some((item) =>
    normalizeValue(item.seguimiento_dias) === normalizeValue('Seg 30 Dias') && isFinalized(item.estado)
  );
  const has45 = records.some((item) =>
    normalizeValue(item.seguimiento_dias) === normalizeValue('Seg 45 Dias') && isFinalized(item.estado)
  );
  if (hasFallecido) {
    return { progress: 100, has30: true, has45: true };
  }
  const progress = (has30 ? 50 : 0) + (has45 ? 50 : 0);
  return { progress, has30, has45 };
}

function renderTable(rows, followups) {
  const tbody = document.getElementById('seguimientos-body');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No hay seguimientos para mostrar.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  const now = new Date();

  rows.forEach(({ venta, confirmada }) => {
    const row = document.createElement('tr');
    const createdAt = new Date(confirmada.created_at);
    const daysSince = Math.floor((now - createdAt) / DAY_MS);
    const { progress, has30, has45 } = buildProgressStatus(followups, confirmada.id);

    const tutorCell = document.createElement('td');
    tutorCell.textContent = venta.nombre_cliente || 'N/A';
    row.appendChild(tutorCell);

    const pacienteCell = document.createElement('td');
    pacienteCell.textContent = venta.mascota || 'N/A';
    row.appendChild(pacienteCell);

    const docCell = document.createElement('td');
    docCell.textContent = venta.cedula_cliente || 'N/A';
    row.appendChild(docCell);

    const telCell = document.createElement('td');
    telCell.textContent = venta.telefono || 'N/A';
    row.appendChild(telCell);

    const progressCell = document.createElement('td');
    const track = document.createElement('div');
    track.className = 'progress-track';
    const fill = document.createElement('div');
    fill.className = 'progress-fill';
    fill.style.width = `${progress}%`;
    track.appendChild(fill);
    const label = document.createElement('div');
    label.className = 'progress-label';
    label.textContent = `${progress}%`;
    progressCell.appendChild(track);
    progressCell.appendChild(label);
    row.appendChild(progressCell);

    const btn30Cell = document.createElement('td');
    const btn30 = document.createElement('a');
    btn30.href = `form_seguimiento_vets_30_dias.html?venta_confirmada_id=${encodeURIComponent(confirmada.id)}`;
    btn30.className = 'btn-followup';
    btn30.textContent = has30 ? 'Finalizado' : 'Realizar';
    if (has30) {
      btn30.classList.add('ready');
      btn30.setAttribute('aria-disabled', 'true');
      btn30.addEventListener('click', (event) => event.preventDefault());
    } else if (isReminderActive(followups, confirmada.id, 'Seg 30 Dias')) {
      btn30.classList.add('reminder');
    } else if (daysSince >= FOLLOWUP_30_DAYS) {
      btn30.classList.add('ready');
    }
    btn30Cell.appendChild(btn30);
    row.appendChild(btn30Cell);

    const btn45Cell = document.createElement('td');
    const btn45 = document.createElement('a');
    btn45.href = `form_seguimiento_vets_45_dias.html?venta_confirmada_id=${encodeURIComponent(confirmada.id)}`;
    btn45.className = 'btn-followup';
    btn45.textContent = has45 ? 'Finalizado' : 'Realizar';
    if (has45) {
      btn45.classList.add('ready');
      btn45.setAttribute('aria-disabled', 'true');
      btn45.addEventListener('click', (event) => event.preventDefault());
    } else if (isReminderActive(followups, confirmada.id, 'Seg 45 Dias')) {
      btn45.classList.add('reminder');
    } else if (daysSince >= FOLLOWUP_45_DAYS) {
      btn45.classList.add('ready');
    }
    btn45Cell.appendChild(btn45);
    row.appendChild(btn45Cell);

    tbody.appendChild(row);
  });
}

async function loadSeguimientos(context) {
  const tbody = document.getElementById('seguimientos-body');
  tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Cargando seguimientos...</td></tr>';

  try {
    const ventasResponse = await fetch(VENTAS_API, {
      headers: { 'Authorization': `Bearer ${context.token}` }
    });

    const ventasData = await ventasResponse.json();
    if (!ventasResponse.ok) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Error al cargar ventas.</td></tr>';
      return;
    }

    const rows = buildSeguimientoRows(ventasData, context);
    const confirmadaIds = rows.map((item) => item.confirmada.id);
    let followups = [];

    if (confirmadaIds.length) {
      const idsParam = confirmadaIds.join(',');
      const [followupResponse, followup45Response] = await Promise.all([
        fetch(`${SEGUIMIENTOS_API}?venta_confirmada_ids=${encodeURIComponent(idsParam)}`, {
          headers: { 'Authorization': `Bearer ${context.token}` }
        }),
        fetch(`${SEGUIMIENTOS_45_API}?venta_confirmada_ids=${encodeURIComponent(idsParam)}`, {
          headers: { 'Authorization': `Bearer ${context.token}` }
        })
      ]);

      const followupData = await followupResponse.json();
      const followup45Data = await followup45Response.json();

      if (followupResponse.ok) {
        followups = Array.isArray(followupData) ? followupData : [];
      }

      if (followup45Response.ok && Array.isArray(followup45Data)) {
        followups = followups.concat(followup45Data);
      }
    }

    renderTable(rows, followups);
  } catch (error) {
    console.error('Error al cargar seguimientos:', error);
    tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Error de conexion.</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const context = await verifyAccess();
  if (!context) return;

  document.getElementById('btn-back').addEventListener('click', () => {
    window.location.href = 'veterinario_tutores.html';
  });

  document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('supabase-session-token');
    localStorage.removeItem('user-rol');
    localStorage.removeItem('user-estado');
    window.location.href = 'inicio_sesion.html';
  });

  loadSeguimientos(context);
  setInterval(() => loadSeguimientos(context), 60000);
});
