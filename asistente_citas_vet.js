const CLIENTES_API = '/api/clientes_klean_vet';
const CITAS_API = '/api/citas_klean_vet';
const VETS_API = '/api/ventas_tutores/veterinarios';
const AUTH_BASE_URL = '/api/auth';

const state = {
    view: 'week',
    baseDate: new Date(),
    citas: [],
    vets: [],
    vetName: '',
    isAdmin: false
};

let selectedClient = null;
let editCitaId = null;

async function verifyAccess() {
    const token = localStorage.getItem('supabase-session-token');
    if (!token) {
        window.location.href = 'inicio_sesion.html';
        return;
    }

    try {
        const response = await fetch(`${AUTH_BASE_URL}/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            window.location.href = 'inicio_sesion.html';
            return;
        }

        const data = await response.json();
        const role = (data.profile?.rol || '').trim().toLowerCase();
        const isAdmin = role === 'admin';
        const isVeterinario = role === 'veterinario';

        if (!isAdmin && !isVeterinario) {
            window.location.href = 'inicio_sesion.html';
            return;
        }

        state.isAdmin = isAdmin;
        const vetName = String(
            data.profile?.medico_veterinario ||
            data.profile?.nombre_apellido ||
            data.profile?.email ||
            ''
        ).trim();
        state.vetName = vetName;

        const vetLabel = document.getElementById('vet-name');
        if (vetLabel) {
            vetLabel.textContent = vetName ? `Veterinario: ${vetName}` : 'Veterinario';
        }
    } catch (error) {
        window.location.href = 'inicio_sesion.html';
    }
}

function normalizeText(value) {
    const text = String(value || '').trim();
    return text.length ? text : null;
}

function toDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function toDateTimeLocalValue(date) {
    if (!date) return '';
    const value = new Date(date);
    if (isNaN(value.getTime())) return '';
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatLocalDateTime(date) {
    if (!date) return '';
    const value = new Date(date);
    if (isNaN(value.getTime())) return '';
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    const seconds = String(value.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
}

function startOfWeek(date) {
    const copy = new Date(date);
    const day = copy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diff);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function endOfWeek(date) {
    const start = startOfWeek(date);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return end;
}

function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function setStatus(message, type) {
    const el = document.getElementById('status-message');
    if (!el) return;
    if (!message) {
        el.className = 'status-message';
        el.textContent = '';
        return;
    }
    el.textContent = message;
    el.className = `status-message show ${type}`;
}

function setSearchStatus(message, type) {
    const el = document.getElementById('search-result');
    if (!el) return;
    if (!message) {
        el.className = 'status-message';
        el.textContent = '';
        return;
    }
    el.textContent = message;
    el.className = `status-message show ${type}`;
}

function setFormEnabled(enabled) {
    const fields = [
        'medico_veterinario',
        'tipo_atencion',
        'fecha_inicio',
        'fecha_fin',
        'estado_atencion'
    ];
    fields.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.disabled = !enabled;
    });
    const saveBtn = document.getElementById('btn-save');
    if (saveBtn) saveBtn.disabled = !enabled;
}

function updateClientSummary(client) {
    const summary = document.getElementById('client-summary');
    const nameEl = document.getElementById('summary-name');
    const petEl = document.getElementById('summary-pet');
    if (!summary || !nameEl || !petEl) return;
    if (!client) {
        summary.hidden = true;
        nameEl.textContent = '-';
        petEl.textContent = '-';
        return;
    }
    const fullName = [client.nombre, client.apellido].filter(Boolean).join(' ');
    nameEl.textContent = fullName || 'Sin nombre';
    petEl.textContent = client.nombre_mascota ? `Mascota: ${client.nombre_mascota}` : 'Mascota: Sin registrar';
    summary.hidden = false;
}

async function searchClient() {
    const input = document.getElementById('search-num-doc');
    const docValue = normalizeText(input?.value);
    if (!docValue) {
        setSearchStatus('Ingresa un numero de documento valido.', 'status-warning');
        return;
    }

    const token = localStorage.getItem('supabase-session-token');
    if (!token) {
        window.location.href = 'inicio_sesion.html';
        return;
    }

    setSearchStatus('Buscando cliente...', 'status-warning');
    selectedClient = null;
    updateClientSummary(null);
    setFormEnabled(false);

    try {
        const response = await fetch(`${CLIENTES_API}/buscar?numero_documento=${encodeURIComponent(docValue)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            selectedClient = data;
            updateClientSummary(data);
            setSearchStatus('Cliente encontrado. Puedes agendar la cita.', 'status-success');
            setFormEnabled(true);
        } else if (response.status === 404) {
            setSearchStatus('Cliente no registrado. Registra el cliente antes de agendar.', 'status-warning');
        } else {
            const errorData = await response.json().catch(() => ({}));
            setSearchStatus(errorData.message || 'No se pudo validar el cliente.', 'status-error');
        }
    } catch (error) {
        setSearchStatus('No se pudo conectar con el servidor.', 'status-error');
    }
}

async function loadVeterinarios() {
    const token = localStorage.getItem('supabase-session-token');
    if (!token) return [];
    const response = await fetch(VETS_API, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

function fillVetSelects(vets) {
    const select = document.getElementById('medico_veterinario');
    const filter = document.getElementById('filter-vet');
    const edit = document.getElementById('edit-medico');

    if (select) {
        select.innerHTML = '<option value="" disabled selected>Medico Veterinario</option>';
        vets.forEach((name) => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            if (name === state.vetName) option.selected = true;
            select.appendChild(option);
        });
        if (!state.isAdmin) select.disabled = true;
    }

    if (filter) {
        filter.innerHTML = '<option value="">Todos</option>';
        vets.forEach((name) => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            if (name === state.vetName) option.selected = true;
            filter.appendChild(option);
        });
        if (!state.isAdmin) filter.disabled = true;
    }

    if (edit) {
        edit.innerHTML = '<option value="" disabled selected>Medico Veterinario</option>';
        vets.forEach((name) => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            edit.appendChild(option);
        });
    }
}

function buildStatusTag(status) {
    const normalized = String(status || '').toLowerCase().replace(/\s+/g, '');
    let statusClass = 'status-sin';
    if (normalized === 'atendiendo') statusClass = 'status-atendiendo';
    if (normalized === 'noasiste') statusClass = 'status-noasiste';
    if (normalized === 'atendido') statusClass = 'status-atendido';
    if (normalized === 'noapto') statusClass = 'status-noapto';

    return `<span class="tag ${statusClass}">${status || 'Sin atender'}</span>`;
}

function formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(date) {
    return date.toLocaleDateString('es-CO', {
        weekday: 'short',
        day: '2-digit',
        month: 'short'
    });
}

function formatMonthLabel(date) {
    return date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

function getRangeForView() {
    const base = state.baseDate;
    if (state.view === 'day') {
        const start = new Date(base);
        start.setHours(0, 0, 0, 0);
        const end = addDays(start, 1);
        return { start, end, label: formatDateLabel(start) };
    }
    if (state.view === 'tomorrow') {
        const day = addDays(base, 1);
        const start = new Date(day);
        start.setHours(0, 0, 0, 0);
        const end = addDays(start, 1);
        return { start, end, label: `Manana - ${formatDateLabel(start)}` };
    }
    if (state.view === 'week' || state.view === 'week-vet') {
        const start = startOfWeek(base);
        const end = endOfWeek(base);
        const label = `${formatDateLabel(start)} - ${formatDateLabel(addDays(end, -1))}`;
        return { start, end, label };
    }
    const start = startOfMonth(base);
    const end = endOfMonth(base);
    return { start, end, label: formatMonthLabel(start) };
}

function filterCitasByRange(citas, start, end) {
    return citas.filter((cita) => {
        const inicio = new Date(cita.fecha_inicio);
        if (isNaN(inicio.getTime())) return false;
        return inicio >= start && inicio < end;
    });
}

async function fetchCitas() {
    const token = localStorage.getItem('supabase-session-token');
    if (!token) return [];

    const vetFilter = document.getElementById('filter-vet');
    const statusFilter = document.getElementById('filter-status');
    const params = new URLSearchParams();

    if (vetFilter?.value) {
        params.set('vet', vetFilter.value);
    } else if (state.vetName) {
        params.set('vet', state.vetName);
    }
    if (statusFilter?.value) params.set('status', statusFilter.value);

    const { start } = getRangeForView();
    if (state.view === 'day' || state.view === 'tomorrow') {
        params.set('date', toDateInputValue(start));
    }

    const response = await fetch(`${CITAS_API}?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

function setCardDataset(card, cita) {
    card.dataset.citaId = cita.id_cita || cita.id || '';
}

function createCitaCard(cita) {
    const nombreCliente = [cita.cliente_nombre, cita.cliente_apellido].filter(Boolean).join(' ');
    const mascota = cita.cliente_mascota || 'Mascota sin registrar';
    const card = document.createElement('div');
    card.className = 'cita-card';
    card.innerHTML = `
        <div class="cita-title">${nombreCliente || 'Cliente'}</div>
        <div class="cita-meta">${mascota}</div>
        <div class="cita-meta">${formatTime(cita.fecha_inicio)} - ${formatTime(cita.fecha_fin)}</div>
        <div class="cita-meta">Medico: ${cita.medico_veterinario || 'Sin asignar'}</div>
        <div class="cita-meta">Tipo: ${cita.tipo_atencion || 'Sin definir'}</div>
        <div class="cita-tags">${buildStatusTag(cita.estado)}</div>
    `;
    setCardDataset(card, cita);
    return card;
}

function renderDayView(citas, range) {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const dayList = document.createElement('div');
    dayList.className = 'day-list';
    const sorted = [...citas].sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio));

    sorted.forEach((cita) => {
        const card = createCitaCard(cita);
        card.classList.add('day-card');
        dayList.appendChild(card);
    });

    if (!sorted.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No hay citas para hoy.';
        grid.appendChild(empty);
        return;
    }

    grid.appendChild(dayList);
}

function renderWeekView(citas, range) {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const headers = document.createElement('div');
    headers.className = 'week-grid';
    const dayNames = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
    dayNames.forEach((name) => {
        const header = document.createElement('div');
        header.className = 'day-header';
        header.textContent = name;
        headers.appendChild(header);
    });
    grid.appendChild(headers);

    const week = document.createElement('div');
    week.className = 'week-grid';
    for (let i = 0; i < 7; i += 1) {
        const day = addDays(range.start, i);
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = addDays(dayStart, 1);
        const dayCitas = filterCitasByRange(citas, dayStart, dayEnd);

        const cell = document.createElement('div');
        cell.className = 'day-cell';
        cell.dataset.date = toDateInputValue(dayStart);
        const number = document.createElement('div');
        number.className = 'day-number';
        number.textContent = day.getDate();
        cell.appendChild(number);

        dayCitas.slice(0, 3).forEach((cita) => {
            const item = document.createElement('div');
            item.className = 'day-item';
            const nombreCliente = [cita.cliente_nombre, cita.cliente_apellido].filter(Boolean).join(' ');
            item.innerHTML = `<strong>${formatTime(cita.fecha_inicio)}</strong> ${nombreCliente || 'Cliente'}`;
            item.dataset.citaId = cita.id_cita || cita.id || '';
            cell.appendChild(item);
        });

        if (dayCitas.length > 3) {
            const more = document.createElement('div');
            more.className = 'day-item';
            more.textContent = `+${dayCitas.length - 3} mas`;
            cell.appendChild(more);
        }

        week.appendChild(cell);
    }
    grid.appendChild(week);
}

function renderWeekVetView(citas, range) {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const vets = state.vets.length ? state.vets : ['Sin veterinario'];
    const wrapper = document.createElement('div');
    wrapper.className = 'week-vet-grid';
    wrapper.style.setProperty('--vet-columns', vets.length);

    const headerRow = document.createElement('div');
    headerRow.className = 'week-vet-row';
    const emptyHeader = document.createElement('div');
    emptyHeader.className = 'week-vet-header';
    emptyHeader.textContent = '';
    headerRow.appendChild(emptyHeader);
    vets.forEach((vet) => {
        const header = document.createElement('div');
        header.className = 'week-vet-header';
        header.textContent = vet;
        headerRow.appendChild(header);
    });
    wrapper.appendChild(headerRow);

    for (let i = 0; i < 7; i += 1) {
        const day = addDays(range.start, i);
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = addDays(dayStart, 1);
        const row = document.createElement('div');
        row.className = 'week-vet-row';

        const label = document.createElement('div');
        label.className = 'week-vet-label';
        label.textContent = formatDateLabel(dayStart);
        row.appendChild(label);

        vets.forEach((vet) => {
            const cell = document.createElement('div');
            cell.className = 'week-vet-cell';
            cell.dataset.date = toDateInputValue(dayStart);
            cell.dataset.vet = vet;
            const vetCitas = citas.filter((cita) => {
                const inicio = new Date(cita.fecha_inicio);
                if (isNaN(inicio.getTime())) return false;
                if (inicio < dayStart || inicio >= dayEnd) return false;
                const vetMatch = (cita.medico_veterinario || '') === vet;
                return vet === 'Sin veterinario' ? !cita.medico_veterinario : vetMatch;
            });
            vetCitas.forEach((cita) => {
                cell.appendChild(createCitaCard(cita));
            });
            row.appendChild(cell);
        });
        wrapper.appendChild(row);
    }

    grid.appendChild(wrapper);
}

function renderMonthView(citas, range) {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const headers = document.createElement('div');
    headers.className = 'month-grid';
    const dayNames = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
    dayNames.forEach((name) => {
        const header = document.createElement('div');
        header.className = 'day-header';
        header.textContent = name;
        headers.appendChild(header);
    });
    grid.appendChild(headers);

    const month = document.createElement('div');
    month.className = 'month-grid';
    const first = new Date(range.start);
    const startDay = first.getDay() === 0 ? 7 : first.getDay();
    const blanks = startDay - 1;
    for (let i = 0; i < blanks; i += 1) {
        const blank = document.createElement('div');
        blank.className = 'day-cell';
        blank.style.opacity = '0.4';
        month.appendChild(blank);
    }

    const totalDays = new Date(range.start.getFullYear(), range.start.getMonth() + 1, 0).getDate();
    for (let dayNum = 1; dayNum <= totalDays; dayNum += 1) {
        const day = new Date(range.start.getFullYear(), range.start.getMonth(), dayNum);
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = addDays(dayStart, 1);
        const dayCitas = filterCitasByRange(citas, dayStart, dayEnd);

        const cell = document.createElement('div');
        cell.className = 'day-cell';
        cell.dataset.date = toDateInputValue(dayStart);
        const number = document.createElement('div');
        number.className = 'day-number';
        number.textContent = dayNum;
        cell.appendChild(number);

        dayCitas.slice(0, 2).forEach((cita) => {
            const item = document.createElement('div');
            item.className = 'day-item';
            const nombreCliente = [cita.cliente_nombre, cita.cliente_apellido].filter(Boolean).join(' ');
            item.innerHTML = `<strong>${formatTime(cita.fecha_inicio)}</strong> ${nombreCliente || 'Cliente'}`;
            item.dataset.citaId = cita.id_cita || cita.id || '';
            cell.appendChild(item);
        });

        if (dayCitas.length > 2) {
            const more = document.createElement('div');
            more.className = 'day-item';
            more.textContent = `+${dayCitas.length - 2} mas`;
            cell.appendChild(more);
        }

        month.appendChild(cell);
    }

    grid.appendChild(month);
}

function attachCardInteractions() {
    const cards = Array.from(document.querySelectorAll('.cita-card'));
    cards.forEach((card) => {
        card.addEventListener('click', () => {
            const citaId = card.dataset.citaId;
            if (citaId) openEditModal(citaId);
        });
    });

    const dayItems = Array.from(document.querySelectorAll('.day-item[data-cita-id]'));
    dayItems.forEach((item) => {
        item.addEventListener('click', () => {
            const citaId = item.dataset.citaId;
            if (citaId) openEditModal(citaId);
        });
    });
}

async function updateCita(citaId, payload, silent) {
    const token = localStorage.getItem('supabase-session-token');
    if (!token) return;
    try {
        const response = await fetch(`${CITAS_API}/${encodeURIComponent(citaId)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (!silent) setStatus(result.message || 'No se pudo actualizar la cita.', 'status-error');
            return;
        }
        if (!silent) {
            setStatus('Cita actualizada correctamente.', 'status-success');
        }
        await loadCalendar();
    } catch (error) {
        if (!silent) setStatus('No se pudo conectar con el servidor.', 'status-error');
    }
}

function openEditModal(citaId) {
    const modal = document.getElementById('edit-modal');
    const cita = state.citas.find((item) => String(item.id_cita || item.id) === String(citaId));
    if (!modal || !cita) return;
    editCitaId = citaId;
    const medico = document.getElementById('edit-medico');
    const tipo = document.getElementById('edit-tipo');
    const inicio = document.getElementById('edit-inicio');
    const fin = document.getElementById('edit-fin');
    const estado = document.getElementById('edit-estado');

    if (medico) medico.value = cita.medico_veterinario || '';
    if (tipo) tipo.value = cita.tipo_atencion || '';
    if (inicio) inicio.value = toDateTimeLocalValue(cita.fecha_inicio);
    if (fin) fin.value = toDateTimeLocalValue(cita.fecha_fin);
    if (estado) estado.value = cita.estado || 'Sin atender';

    const disableFields = !state.isAdmin;
    if (medico) medico.disabled = disableFields;
    if (tipo) tipo.disabled = disableFields;
    if (inicio) inicio.disabled = disableFields;
    if (fin) fin.disabled = disableFields;

    modal.hidden = false;
}

function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    if (!modal) return;
    modal.hidden = true;
    editCitaId = null;
}

async function handleEditSubmit(event) {
    event.preventDefault();
    if (!editCitaId) return;

    const payload = {
        estado: normalizeText(document.getElementById('edit-estado')?.value)
    };

    if (state.isAdmin) {
        payload.medico_veterinario = normalizeText(document.getElementById('edit-medico')?.value);
        payload.tipo_atencion = normalizeText(document.getElementById('edit-tipo')?.value);
        payload.fecha_inicio = normalizeText(document.getElementById('edit-inicio')?.value);
        payload.fecha_fin = normalizeText(document.getElementById('edit-fin')?.value);
    }

    await updateCita(editCitaId, payload, false);
    closeEditModal();
}

async function loadCalendar() {
    const emptyState = document.getElementById('calendar-empty');
    const label = document.getElementById('calendar-label');
    if (label) label.textContent = getRangeForView().label;

    state.citas = await fetchCitas();
    const range = getRangeForView();
    const filtered = state.view === 'day' || state.view === 'tomorrow'
        ? state.citas
        : filterCitasByRange(state.citas, range.start, range.end);

    if (!filtered.length) {
        if (emptyState) emptyState.hidden = false;
    } else if (emptyState) {
        emptyState.hidden = true;
    }

    if (state.view === 'day' || state.view === 'tomorrow') {
        renderDayView(filtered, range);
    } else if (state.view === 'week') {
        renderWeekView(filtered, range);
    } else if (state.view === 'week-vet') {
        renderWeekVetView(filtered, range);
    } else {
        renderMonthView(filtered, range);
    }

    attachCardInteractions();
}

async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedClient?.id_cliente) {
        setSearchStatus('Debes seleccionar un cliente para agendar.', 'status-warning');
        return;
    }

    const medico = normalizeText(document.getElementById('medico_veterinario')?.value || state.vetName);
    const tipo = normalizeText(document.getElementById('tipo_atencion')?.value);
    const inicio = normalizeText(document.getElementById('fecha_inicio')?.value);
    const fin = normalizeText(document.getElementById('fecha_fin')?.value);
    const estado = normalizeText(document.getElementById('estado_atencion')?.value) || 'Sin atender';

    if (!medico || !tipo || !inicio || !fin) {
        setSearchStatus('Completa todos los campos obligatorios.', 'status-warning');
        return;
    }

    const token = localStorage.getItem('supabase-session-token');
    if (!token) {
        window.location.href = 'inicio_sesion.html';
        return;
    }

    const payload = {
        cliente_id: selectedClient.id_cliente,
        medico_veterinario: medico,
        tipo_atencion: tipo,
        fecha_inicio: inicio,
        fecha_fin: fin,
        estado
    };

    const saveBtn = document.getElementById('btn-save');
    if (saveBtn) saveBtn.disabled = true;

    try {
        const response = await fetch(CITAS_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json().catch(() => ({}));
        if (response.ok) {
            setSearchStatus('Cita creada correctamente.', 'status-success');
            event.target.reset();
            setFormEnabled(false);
            updateClientSummary(null);
            selectedClient = null;
            await loadCalendar();
        } else {
            setSearchStatus(result.message || 'No se pudo guardar la cita.', 'status-error');
        }
    } catch (error) {
        setSearchStatus('No se pudo conectar con el servidor.', 'status-error');
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

function setupViewButtons() {
    const buttons = Array.from(document.querySelectorAll('.tab-btn'));
    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            buttons.forEach((btn) => btn.classList.toggle('active', btn === button));
            state.view = button.dataset.view || 'day';
            if (state.view === 'day' || state.view === 'tomorrow') {
                state.baseDate = new Date();
            }
            loadCalendar();
        });
    });
}

function moveCalendar(step) {
    if (state.view === 'day' || state.view === 'tomorrow') {
        state.baseDate = addDays(state.baseDate, step);
    } else if (state.view === 'week' || state.view === 'week-vet') {
        state.baseDate = addDays(state.baseDate, step * 7);
    } else {
        state.baseDate = new Date(state.baseDate.getFullYear(), state.baseDate.getMonth() + step, 1);
    }
    loadCalendar();
}

document.addEventListener('DOMContentLoaded', async () => {
    await verifyAccess();

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('supabase-session-token');
            localStorage.removeItem('user-rol');
            localStorage.removeItem('user-estado');
            window.location.href = 'inicio_sesion.html';
        });
    }

    const backPageBtn = document.getElementById('btn-back-page');
    if (backPageBtn) {
        backPageBtn.addEventListener('click', () => window.history.back());
    }

    const searchInput = document.getElementById('search-num-doc');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }

    const searchButton = document.getElementById('btn-search');
    if (searchButton) {
        searchButton.addEventListener('click', searchClient);
    }

    if (searchInput) {
        searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                searchClient();
            }
        });
    }

    const form = document.getElementById('cita-form');
    if (form) {
        form.addEventListener('submit', handleSubmit);
    }

    const editForm = document.getElementById('edit-form');
    if (editForm) {
        editForm.addEventListener('submit', handleEditSubmit);
    }

    const modal = document.getElementById('edit-modal');
    if (modal) {
        modal.querySelectorAll('[data-close-modal]').forEach((btn) => {
            btn.addEventListener('click', closeEditModal);
        });
    }

    const filterVet = document.getElementById('filter-vet');
    if (filterVet) filterVet.addEventListener('change', loadCalendar);

    const filterStatus = document.getElementById('filter-status');
    if (filterStatus) filterStatus.addEventListener('change', loadCalendar);

    const refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn) refreshBtn.addEventListener('click', loadCalendar);

    const prevBtn = document.getElementById('btn-prev');
    if (prevBtn) prevBtn.addEventListener('click', () => moveCalendar(-1));

    const nextBtn = document.getElementById('btn-next');
    if (nextBtn) nextBtn.addEventListener('click', () => moveCalendar(1));

    setupViewButtons();
    setFormEnabled(false);

    if (state.vetName) {
        state.vets = [state.vetName];
    } else {
        state.vets = await loadVeterinarios();
    }
    fillVetSelects(state.vets);
    await loadCalendar();
});
