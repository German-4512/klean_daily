const API_BASE_URL = 'http://localhost:3001/api/creditos_kv';
const CREDITOS_VETS_API_BASE_URL = 'http://localhost:3001/api/creditos_vets';
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
    const isAgenteMayor = role === 'agente mayor' && estado === 'activo';

    if (!isAdmin && !isCallCenter && !isDataVentas && !isAgenteMayor) {
      window.location.href = 'inicio_sesion.html';
      return null;
    }

    return token;
  } catch (error) {
    window.location.href = 'inicio_sesion.html';
    return null;
  }
}

const creditStatusOptions = ['P. Pago', 'Paz y salvo', 'Abono'];

function buildSelect(options, className, selectedValue) {
  const select = document.createElement('select');
  select.className = className;
  const normalizedSelected = normalizeValue(selectedValue);

  options.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    if (normalizedSelected && normalizeValue(value) === normalizedSelected) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  if (normalizedSelected && !select.value) {
    const option = document.createElement('option');
    option.value = selectedValue;
    option.textContent = selectedValue;
    option.selected = true;
    select.appendChild(option);
  }

  return select;
}

async function loadCreditos(token, rangeOptions = {}, estadoCredito = '') {
  const tbody = document.getElementById('creditos-body');
  tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Cargando creditos...</td></tr>';

  try {
    const [response, vetsResponse] = await Promise.all([
      fetch(API_BASE_URL, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(CREDITOS_VETS_API_BASE_URL, { headers: { 'Authorization': `Bearer ${token}` } })
    ]);

    const data = await response.json();
    const vetsData = await vetsResponse.json();
    if (!response.ok) {
      tbody.innerHTML = `<tr><td colspan="8" class="table-empty">Error: ${data.message || 'No se pudo cargar.'}</td></tr>`;
      return;
    }
    if (!vetsResponse.ok) {
      console.error('Error al cargar creditos vets:', vetsData);
    }

    const rows = [];
    const hasRange = Boolean(rangeOptions.month || rangeOptions.preset);
    const range = hasRange ? buildRange(rangeOptions) : null;
    data.forEach((item) => {
      if (item.estado_preventa && !isConfirmada(item.estado_preventa)) return;
      if (item.metodo_pago && !isCredito(item.metodo_pago)) return;

      if (hasRange) {
        const fecha = new Date(item.fechapreventa);
        const inRange = !isNaN(fecha.getTime()) && fecha >= range.start && fecha < range.end;
        if (!inRange) return;
      }

      const estadoActual = item.estado_credito || 'P. Pago';
      if (estadoCredito && normalizeValue(estadoActual) !== normalizeValue(estadoCredito)) return;

      rows.push({
        area: 'Call Center',
        tipo: 'call',
        creditoId: item.id,
        preventaId: item.preventa_id || item.preventaId || item.id,
        date: item.fechapreventa,
        numDoc: item.num_doc || 'N/A',
        telContacto: item.tel_contacto || item.telContacto || 'N/A',
        tutor: item.nombre_tutor || 'N/A',
        saldoPendiente: item.saldo_pendiente,
        estadoCredito: estadoActual,
        agenteId: item.agente_id || null
      });
    });

    (vetsResponse.ok ? vetsData : []).forEach((item) => {
      if (!isCredito(item.metodo_pago)) return;
      if (!(Number(item.saldo_pendiente) > 0)) return;

      const fechaVenta = item.fecha_venta || item.created_at || null;
      if (hasRange) {
        const fecha = new Date(fechaVenta);
        const inRange = !isNaN(fecha.getTime()) && fecha >= range.start && fecha < range.end;
        if (!inRange) return;
      }

      const estadoActual = item.estado_credito || 'P. Pago';
      if (estadoCredito && normalizeValue(estadoActual) !== normalizeValue(estadoCredito)) return;

      rows.push({
        area: 'Vets',
        tipo: 'vets',
        creditoId: item.id,
        ventaConfirmadaId: item.venta_confirmada_id || item.ventaConfirmadaId || item.id,
        ventaTutorId: item.venta_tutor_id || item.ventaTutorId || null,
        date: fechaVenta,
        numDoc: item.cedula_cliente || 'N/A',
        telContacto: item.telefono || 'N/A',
        tutor: item.nombre_cliente || 'N/A',
        saldoPendiente: item.saldo_pendiente,
        estadoCredito: estadoActual
      });
    });

    tbody.innerHTML = '';
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No hay creditos confirmados para el filtro seleccionado.</td></tr>';
      return;
    }

    rows.forEach((row) => {
      const tr = document.createElement('tr');
      const saldoValue = row.saldoPendiente !== null && row.saldoPendiente !== undefined
        ? String(row.saldoPendiente)
        : '';

      const saldoCell = document.createElement('td');
      const saldoInput = document.createElement('input');
      saldoInput.type = 'number';
      saldoInput.className = 'cell-input';
      saldoInput.min = '0';
      saldoInput.step = '0.01';
      saldoInput.placeholder = '0';
      saldoInput.value = saldoValue;
      saldoCell.appendChild(saldoInput);

      const estadoCell = document.createElement('td');
      const estadoSelect = buildSelect(creditStatusOptions, 'cell-select', row.estadoCredito);
      estadoCell.appendChild(estadoSelect);

      const saveCell = document.createElement('td');
      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.className = 'btn-save';
      saveButton.textContent = 'Guardar';
      saveButton.addEventListener('click', async () => {
        const saldoRaw = saldoInput.value ?? '';
        const saldoValueUpdate = saldoRaw === '' ? null : Number(saldoRaw);
        if (saldoRaw !== '' && !Number.isFinite(saldoValueUpdate)) {
          alert('El saldo pendiente debe ser un numero valido.');
          return;
        }

        if (saldoValueUpdate !== null && saldoValueUpdate > 0 && normalizeValue(estadoSelect.value) === 'pazysalvo') {
          alert('No puedes marcar Paz y salvo si el saldo pendiente es mayor a 0.');
          return;
        }

        const payload = row.tipo === 'vets'
          ? {
            saldo_pendiente: saldoValueUpdate,
            estado_credito: estadoSelect.value || 'P. Pago'
          }
          : {
            saldo_pendiente: saldoValueUpdate,
            estado_credito: estadoSelect.value || 'P. Pago'
          };

        try {
          const endpoint = row.tipo === 'vets'
            ? `${CREDITOS_VETS_API_BASE_URL}/${row.ventaConfirmadaId}`
            : `${API_BASE_URL}/${row.preventaId}`;
          const updateResponse = await fetch(endpoint, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
          });

          const result = await updateResponse.json();
          if (!updateResponse.ok) {
            alert(`Error al guardar: ${result.message || 'No se pudo guardar.'}`);
            return;
          }

          const previousSaldo = Number(row.saldoPendiente || 0);
          const currentSaldo = saldoValueUpdate === null ? 0 : saldoValueUpdate;
          const recaudoMonto = Math.max(0, previousSaldo - currentSaldo);
          const estadoNuevo = estadoSelect.value || 'P. Pago';
          const normalizedEstado = normalizeValue(estadoNuevo);
          const tipoRecaudo = normalizedEstado === 'pazysalvo'
            ? 'Paz y salvo'
            : normalizedEstado === 'abono'
              ? 'Abono'
              : null;
          const shouldCreateRecaudo = tipoRecaudo === 'Paz y salvo' || (tipoRecaudo === 'Abono' && recaudoMonto > 0);

          if (tipoRecaudo && shouldCreateRecaudo) {
            try {
              const recaudoEndpoint = row.tipo === 'vets'
                ? 'http://localhost:3001/api/recaudo_vets'
                : 'http://localhost:3001/api/recaudo_call';
              const recaudoPayload = row.tipo === 'vets'
                ? {
                  venta_confirmada_id: row.ventaConfirmadaId,
                  venta_tutor_id: row.ventaTutorId,
                  tipo_recaudo: tipoRecaudo,
                  monto: recaudoMonto,
                  saldo_pendiente: saldoValueUpdate
                }
                : {
                  credito_id: row.creditoId,
                  preventa_id: row.preventaId,
                  agente_id: row.agenteId,
                  tipo_recaudo: tipoRecaudo,
                  monto: recaudoMonto
                };
              const recaudoResponse = await fetch(recaudoEndpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(recaudoPayload)
              });

              const recaudoResult = await recaudoResponse.json();
              if (!recaudoResponse.ok) {
                alert(`Guardado credito, pero no se pudo registrar el recaudo: ${recaudoResult.message || 'Error.'}`);
                return;
              }
            } catch (error) {
              console.error('Error al registrar recaudo:', error);
              alert('Guardado credito, pero no se pudo registrar el recaudo.');
              return;
            }
          }

          row.saldoPendiente = saldoValueUpdate;
          row.estadoCredito = estadoNuevo;

          alert('Guardado correctamente.');
        } catch (error) {
          console.error('Error al guardar credito:', error);
          alert('Error de conexion al guardar.');
        }
      });
      saveCell.appendChild(saveButton);

      tr.innerHTML = `
        <td>${formatDateTime(row.date)}</td>
        <td>${row.area}</td>
        <td>${row.numDoc}</td>
        <td>${row.telContacto}</td>
        <td>${row.tutor}</td>
      `;
      tr.appendChild(saldoCell);
      tr.appendChild(estadoCell);
      tr.appendChild(saveCell);
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
