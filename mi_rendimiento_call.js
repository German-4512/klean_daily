const API_BASE_URL = 'http://localhost:3001/api/preventascall';
const AUTH_BASE_URL = 'http://localhost:3001/api/auth';

const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatCurrency(value) {
  const numberValue = Number(value || 0);
  return numberValue.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

function renderBars(container, labels, values, formatter) {
  container.innerHTML = '';
  const maxValue = Math.max(...values, 1);
  const maxHeight = 160;

  labels.forEach((label, index) => {
    const value = values[index] || 0;
    const displayValue = formatter ? formatter(value) : String(value);
    const bar = document.createElement('div');
    bar.className = 'bar';

    const barValue = document.createElement('div');
    barValue.className = 'bar-value';
    barValue.textContent = displayValue;

    const barVisual = document.createElement('div');
    barVisual.className = 'bar-visual';
    const heightPx = Math.max((value / maxValue) * maxHeight, 6);
    barVisual.style.height = `${heightPx}px`;
    barVisual.title = displayValue;

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

async function loadMetrics(token) {
  const response = await fetch(`${API_BASE_URL}/metrics`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const contentType = response.headers.get('content-type') || '';
  let data;

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    console.error('Respuesta no JSON:', response.status, text.slice(0, 200));
    return;
  }

  if (!response.ok) {
    console.error('Error al cargar métricas:', data);
    return;
  }

  const unidadesMes = Array.isArray(data.unidadesByDay)
    ? data.unidadesByDay.reduce((sum, value) => sum + (Number(value) || 0), 0)
    : (data.totalPreventasMes || 0);
  document.getElementById('metric-preventas').textContent = unidadesMes;
  document.getElementById('metric-clientes').textContent = data.totalClientes || 0;
  document.getElementById('metric-comisiones').textContent = formatCurrency(data.totalComisionesNetas || 0);
  document.getElementById('metric-retenidas').textContent = formatCurrency(data.totalComisionesRetenidas || 0);
  document.getElementById('metric-comisiones-general').textContent = formatCurrency(data.totalComisionesGenerales || 0);
  document.getElementById('metric-unidades').textContent = data.totalUnidades || 0;

  const dayLabels = data.byDay.map((_, index) => String(index + 1));
  const dayChart = document.getElementById('chart-by-day');
  const unidadesByDay = Array.isArray(data.unidadesByDay) ? data.unidadesByDay : data.byDay;
  renderBars(dayChart, dayLabels, unidadesByDay);

  const monthChart = document.getElementById('chart-by-month');
  const unitsByMonth = Array.isArray(data.unidadesByMonth) ? data.unidadesByMonth : data.byMonth;
  renderBars(monthChart, monthLabels, unitsByMonth);

  const clientsMonthChart = document.getElementById('chart-clients-by-month');
  if (clientsMonthChart) {
    const clientsByMonth = Array.isArray(data.clientesByMonth) ? data.clientesByMonth : [];
    renderBars(clientsMonthChart, monthLabels, clientsByMonth);
  }

  const comisionesMonthChart = document.getElementById('chart-comisiones-by-month');
  if (comisionesMonthChart) {
    const comisionesByMonth = Array.isArray(data.comisionesByMonth) ? data.comisionesByMonth : [];
    renderBars(comisionesMonthChart, monthLabels, comisionesByMonth, formatCurrency);
  }

  const retenidasMonthChart = document.getElementById('chart-retenidas-by-month');
  if (retenidasMonthChart) {
    const retenidasByMonth = Array.isArray(data.retenidasByMonth) ? data.retenidasByMonth : [];
    renderBars(retenidasMonthChart, monthLabels, retenidasByMonth, formatCurrency);
  }

  const productContainer = document.getElementById('chart-products');
  if (Array.isArray(data.unidadesPorProducto) && data.unidadesPorProducto.length) {
    const labels = data.unidadesPorProducto.map((item) => item.producto);
    const values = data.unidadesPorProducto.map((item) => item.unidades);
    const barChart = document.createElement('div');
    barChart.className = 'bar-chart';
    productContainer.innerHTML = '';
    productContainer.appendChild(barChart);
    renderBars(barChart, labels, values);
  } else {
    productContainer.textContent = 'Sin datos de productos.';
  }

  const monthLabel = new Date().toLocaleString('es-CO', { month: 'long' });
  document.getElementById('chart-month-label').textContent = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  document.getElementById('chart-year-label').textContent = new Date().getFullYear();
  const clientsYearLabel = document.getElementById('chart-clients-year-label');
  if (clientsYearLabel) clientsYearLabel.textContent = new Date().getFullYear();
  const comisionesYearLabel = document.getElementById('chart-comisiones-year-label');
  if (comisionesYearLabel) comisionesYearLabel.textContent = new Date().getFullYear();
  const retenidasYearLabel = document.getElementById('chart-retenidas-year-label');
  if (retenidasYearLabel) retenidasYearLabel.textContent = new Date().getFullYear();
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

  loadMetrics(token);
});
