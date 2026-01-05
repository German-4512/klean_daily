const PREVENTAS_API = '/api/preventascall';
const ADVISORS_API = '/api/preventascall/advisors';
const AUTH_BASE_URL = '/api/auth';
const RENDIMIENTO_DAILY_API = '/api/rendimiento_daily';
const FLUSH_DELAY_MS = 800;

let authToken = null;
let isReadOnly = false;
let flushTimer = null;
let isFlushing = false;
const pendingDeltas = new Map();

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
        const isAgenteMayor = role === 'agente mayor' && estado === 'activo';
        const isInvitado = role === 'invitado';

        if (!isAdmin && !isAgenteMayor && !isInvitado) {
            window.location.href = 'inicio_sesion.html';
            return null;
        }

        return {
            token,
            profile: data.profile || null,
            userId: data.user?.id || null,
            role
        };
    } catch (error) {
        window.location.href = 'inicio_sesion.html';
        return null;
    }
}

function getRowMeta(row) {
    return {
        persona: row.dataset.persona || '',
        veterinario: row.dataset.veterinario || '',
        tipoVenta: row.dataset.tipoVenta || ''
    };
}

function getRowKey(meta) {
    return `${meta.persona}|${meta.tipoVenta}|${meta.veterinario}`;
}

function setRowValue(row, value) {
    const input = row.querySelector('.counter-value');
    if (input) input.value = String(value);
}

function getRowValue(row) {
    const input = row.querySelector('.counter-value');
    return input ? Number(input.value) || 0 : 0;
}

function updateDailyMetricTotals() {
    const rows = Array.from(document.querySelectorAll('[data-counter]'));
    const totals = rows.reduce((acc, row) => {
        const tipoVenta = row.dataset.tipoVenta || '';
        const value = getRowValue(row);
        if (tipoVenta === 'primera_vez') acc.primera += value;
        if (tipoVenta === 'seguimiento') acc.seguimiento += value;
        return acc;
    }, { primera: 0, seguimiento: 0 });

    const personaTotals = rows.reduce((acc, row) => {
        const persona = row.dataset.persona || '';
        const tipoVenta = row.dataset.tipoVenta || '';
        if (!persona || persona === 'Tienda Virtual') return acc;
        if (tipoVenta !== 'primera_vez' && tipoVenta !== 'seguimiento') return acc;
        acc[persona] = (acc[persona] || 0) + getRowValue(row);
        return acc;
    }, {});

    const metricPrimera = document.getElementById('metric-primera-vez');
    const metricSeguimiento = document.getElementById('metric-seguimiento');
    const metricVentasHoy = document.getElementById('metric-ventas-hoy');
    if (metricPrimera) metricPrimera.textContent = String(totals.primera);
    if (metricSeguimiento) metricSeguimiento.textContent = String(totals.seguimiento);
    if (metricVentasHoy) metricVentasHoy.textContent = String(totals.primera + totals.seguimiento);

    const personaMap = {
        'Diana Marmolejo': 'metric-persona-diana',
        'Laura Duarte': 'metric-persona-laura',
        'Lyda Salcedo': 'metric-persona-lyda',
        'Mateo Moreno': 'metric-persona-mateo'
    };
    Object.entries(personaMap).forEach(([persona, elementId]) => {
        const el = document.getElementById(elementId);
        if (el) el.textContent = String(personaTotals[persona] || 0);
    });
}

async function applyDailyDelta(token, meta, delta) {
    const { persona, veterinario, tipoVenta } = meta;
    if (!persona || !veterinario || !tipoVenta) return null;

    const payload = {
        persona,
        veterinario,
        tipo_venta: tipoVenta,
        delta,
        fecha: getLocalDateString()
    };

    const response = await fetch(RENDIMIENTO_DAILY_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.message || 'No se pudo guardar.');
    }

    return result.data || null;
}

function enqueueDelta(meta, delta) {
    const key = getRowKey(meta);
    const current = pendingDeltas.get(key) || 0;
    pendingDeltas.set(key, current + delta);
    if (!flushTimer) {
        flushTimer = setTimeout(() => flushPending(), FLUSH_DELAY_MS);
    }
}

function findRowByMeta(meta) {
    const rows = Array.from(document.querySelectorAll('[data-counter]'));
    return rows.find((row) => {
        const rowMeta = getRowMeta(row);
        return rowMeta.persona === meta.persona
            && rowMeta.tipoVenta === meta.tipoVenta
            && rowMeta.veterinario === meta.veterinario;
    }) || null;
}

async function flushPending() {
    if (isFlushing) return;
    if (!pendingDeltas.size || !authToken) {
        flushTimer = null;
        return;
    }

    isFlushing = true;
    flushTimer = null;

    const entries = Array.from(pendingDeltas.entries());
    pendingDeltas.clear();

    let hadError = false;
    for (const [key, delta] of entries) {
        if (!delta) continue;
        const [persona, tipoVenta, veterinario] = key.split('|');
        const meta = { persona, tipoVenta, veterinario };
        try {
            const data = await applyDailyDelta(authToken, meta, delta);
            if (data && typeof data.cantidad === 'number') {
                const row = findRowByMeta(meta);
                if (row) setRowValue(row, data.cantidad);
            }
        } catch (error) {
            console.error('Error al guardar rendimiento daily:', error);
            hadError = true;
        }
    }

    updateDailyMetricTotals();

    if (pendingDeltas.size) {
        setTimeout(() => flushPending(), 0);
    } else if (hadError) {
        try {
            await loadDailyCounts(authToken);
        } catch (error) {
            console.error('Error al recargar rendimiento daily:', error);
        }
    }

    isFlushing = false;
}

function attachCounterHandlers(container) {
    container.addEventListener('click', async (event) => {
        if (isReadOnly) return;
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const row = button.closest('[data-counter]');
        if (!row) return;

        const action = button.dataset.action;
        const currentValue = getRowValue(row);
        const delta = action === 'inc' ? 1 : -1;
        const nextValue = Math.max(0, currentValue + delta);
        if (nextValue === currentValue) {
            return;
        }

        setRowValue(row, nextValue);
        updateDailyMetricTotals();

        enqueueDelta(getRowMeta(row), delta);
    });
}

function getUnitsFromPreventa(preventa) {
    let total = 0;
    for (let i = 1; i <= 4; i += 1) {
        const value = Number(preventa[`cant_${i}`]) || 0;
        total += value;
    }
    return total;
}

function isSameDay(dateValue, targetDate) {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return false;
    return date.getFullYear() === targetDate.getFullYear()
        && date.getMonth() === targetDate.getMonth()
        && date.getDate() === targetDate.getDate();
}

function filterPreventasByDate(preventas, targetDate) {
    return (preventas || []).filter((item) => isSameDay(item.fechapreventa, targetDate));
}

function buildTotalsByAdvisor(preventas) {
    const totals = new Map();
    (preventas || []).forEach((item) => {
        const advisorId = item.agente_id || 'sin_asesor';
        const current = totals.get(advisorId) || 0;
        totals.set(advisorId, current + getUnitsFromPreventa(item));
    });
    return totals;
}

function getAdvisorName(profile) {
    const name = String(profile?.nombre_apellido || '').trim();
    if (name) return name;
    const email = String(profile?.email || '').trim();
    if (email) return email;
    return 'Agente Mayor';
}

function buildAdvisorIndex({ advisorsData, preventasData, currentProfile, currentUserId, currentRole }) {
    const index = new Map();

    (advisorsData || []).forEach((advisor) => {
        const id = advisor.id;
        if (!id) return;
        const label = advisor.nombre_apellido || advisor.email || 'Asesor';
        index.set(id, String(label).trim());
    });

    if ((currentRole === 'admin' || currentRole === 'agente mayor') && currentUserId && !index.has(currentUserId)) {
        index.set(currentUserId, getAdvisorName(currentProfile));
    }

    (preventasData || []).forEach((item) => {
        const id = item.agente_id;
        if (!id || index.has(id)) return;
        if ((currentRole === 'admin' || currentRole === 'agente mayor') && currentUserId && id === currentUserId) {
            index.set(id, getAdvisorName(currentProfile));
            return;
        }
        index.set(id, 'Asesor');
    });

    return index;
}

function buildChartSeries({ advisorsData, preventasData, currentProfile, currentUserId, currentRole }) {
    const totals = buildTotalsByAdvisor(preventasData);
    const advisorIndex = buildAdvisorIndex({
        advisorsData,
        preventasData,
        currentProfile,
        currentUserId,
        currentRole
    });
    const labels = [];
    const values = [];
    const seen = new Set();

    (advisorsData || []).forEach((advisor) => {
        if (!advisor.id || seen.has(advisor.id)) return;
        labels.push(advisorIndex.get(advisor.id) || 'Asesor');
        values.push(totals.get(advisor.id) || 0);
        seen.add(advisor.id);
    });

    if ((currentRole === 'admin' || currentRole === 'agente mayor') && currentUserId && !seen.has(currentUserId)) {
        labels.push(advisorIndex.get(currentUserId) || getAdvisorName(currentProfile));
        values.push(totals.get(currentUserId) || 0);
        seen.add(currentUserId);
    }

    advisorIndex.forEach((label, id) => {
        if (seen.has(id)) return;
        labels.push(label);
        values.push(totals.get(id) || 0);
        seen.add(id);
    });

    if (totals.has('sin_asesor')) {
        labels.push('Sin asesor');
        values.push(totals.get('sin_asesor') || 0);
    }

    return { labels, values };
}

function renderBars(labels, values) {
    const chart = document.getElementById('advisor-chart');
    const emptyState = document.getElementById('advisor-chart-empty');
    if (!chart || !emptyState) return;

    chart.innerHTML = '';

    if (!labels.length) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
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
        chart.appendChild(bar);
    });
}

async function loadDailyCounts(token) {
    const date = getLocalDateString();
    const response = await fetch(`${RENDIMIENTO_DAILY_API}?date=${date}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const result = await response.json();
    if (!response.ok) {
        console.error('Error al cargar rendimiento daily:', result);
        return;
    }

    const rows = Array.from(document.querySelectorAll('[data-counter]'));
    const index = new Map();
    (result.data || []).forEach((item) => {
        const key = `${item.persona}|${item.tipo_venta}|${item.veterinario}`;
        index.set(key, item.cantidad || 0);
    });

    rows.forEach((row) => {
        const meta = getRowMeta(row);
        const key = `${meta.persona}|${meta.tipoVenta}|${meta.veterinario}`;
        const value = index.has(key) ? index.get(key) : 0;
        setRowValue(row, value);
    });

    updateDailyMetricTotals();
}

function computePreventasTotal(preventasData, advisorsData) {
    const advisorIds = new Set((advisorsData || []).map((advisor) => advisor.id).filter(Boolean));
    return (preventasData || []).reduce((sum, item) => {
        if (advisorIds.size && !advisorIds.has(item.agente_id)) return sum;
        return sum + getUnitsFromPreventa(item);
    }, 0);
}

async function loadData(token) {
    const today = new Date();
    const params = new URLSearchParams();
    params.append('all', 'true');

    const [advisorsResponse, preventasResponse] = await Promise.all([
        fetch(ADVISORS_API, {
            headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${PREVENTAS_API}?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
    ]);

    const advisorsData = advisorsResponse.ok ? await advisorsResponse.json() : [];
    const preventasData = preventasResponse.ok ? await preventasResponse.json() : [];
    const preventasToday = filterPreventasByDate(preventasData, today);

    const series = buildChartSeries({
        advisorsData,
        preventasData: preventasToday,
        currentProfile: loadData.currentProfile || null,
        currentUserId: loadData.currentUserId || null,
        currentRole: loadData.currentRole || ''
    });

    renderBars(series.labels, series.values);

    const totalPreventas = computePreventasTotal(preventasToday, advisorsData);
    const metricPreventas = document.getElementById('metric-preventas');
    if (metricPreventas) metricPreventas.textContent = String(totalPreventas);
}

function setReadOnlyMode() {
    const buttons = document.querySelectorAll('.counter-btn');
    buttons.forEach((button) => {
        button.disabled = true;
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await verifyAccess();
    if (!session) return;

    authToken = session.token;
    isReadOnly = session.role === 'invitado';

    const backButton = document.getElementById('btn-back');
    if (backButton) {
        backButton.addEventListener('click', () => window.history.back());
    }

    document.getElementById('logout-btn').addEventListener('click', (event) => {
        event.preventDefault();
        localStorage.removeItem('supabase-session-token');
        localStorage.removeItem('user-rol');
        localStorage.removeItem('user-estado');
        window.location.href = 'inicio_sesion.html';
    });

    attachCounterHandlers(document);
    if (isReadOnly) {
        setReadOnlyMode();
    }

    try {
        loadData.currentProfile = session.profile;
        loadData.currentUserId = session.userId;
        loadData.currentRole = session.role;
        await loadDailyCounts(session.token);
        await loadData(session.token);
    } catch (error) {
        console.error('Error al cargar rendimiento dia:', error);
    }
});
