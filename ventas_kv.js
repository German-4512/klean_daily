const API_BASE_URL = '/api/ventas_tutores';
const AUTH_BASE_URL = '/api/auth';
const CREDITOS_VETS_API_BASE_URL = '/api/creditos_vets';
const RECAUDO_VETS_API_BASE_URL = '/api/recaudo_vets';

const paymentOptions = ['Contra Entrega', 'Decontado', 'Credito', 'Devolucion'];
const defaultPayment = 'Decontado';

const montoDefaults = new Map([
    ['1% 15 ml', 129000],
    ['2% 15 ml', 166000],
    ['2% 30 ml', 272000],
    ['pawte', 33000],
    ['balsamo pawte', 33000],
    ['adulto plus', 97000],
    ['klean vet plus adulto', 97000],
    ['plan solidario', 97000],
    ['derma plus', 97000],
    ['klean vet plus derma', 97000],
    ['gastro plus', 97000],
    ['klean vet plus gastro', 97000],
    ['3% 100 ml', 980000]
]);

function formatDate(value) {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleDateString('es-CO');
}

function normalizeValue(value) {
    return String(value || '')
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');
}

function getMontoDefault(producto) {
    const key = normalizeValue(producto);
    return montoDefaults.get(key) || '';
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
        if (role !== 'datos y ventas klean vet' && role !== 'admin') {
            window.location.href = 'inicio_sesion.html';
            return null;
        }

        return token;
    } catch (error) {
        window.location.href = 'inicio_sesion.html';
        return null;
    }
}

function buildSelect(options, className, placeholder, selectedValue) {
    const select = document.createElement('select');
    select.className = className;
    if (placeholder) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = placeholder;
        option.disabled = true;
        option.selected = !selectedValue;
        select.appendChild(option);
    }

    options.forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        if (selectedValue && value === selectedValue) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    return select;
}

function buildQtySelect(selectedValue) {
    const options = Array.from({ length: 8 }, (_, index) => String(index + 1));
    return buildSelect(options, 'cell-select', null, selectedValue || '1');
}

async function loadVentas({ token, preset, date, prescripcion, savedOnly, pendingOnly }) {
    const tbody = document.getElementById('ventas-body');
    tbody.innerHTML = '<tr><td colspan="10" class="table-empty">Cargando ventas...</td></tr>';

    const params = new URLSearchParams();
    if (preset) params.append('preset', preset);
    if (date) params.append('date', date);

    try {
        const response = await fetch(`${API_BASE_URL}?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        let data = await response.json();
        if (!response.ok) {
            tbody.innerHTML = `<tr><td colspan="10" class="table-empty">Error: ${data.message || 'No se pudo cargar.'}</td></tr>`;
            return;
        }

        const prescripcionFiltro = normalizeValue(prescripcion);
        if (prescripcionFiltro) {
            data = data.filter((item) => {
                const value = item.prescripcion || item.fecha_prescripcion || '';
                return normalizeValue(value).includes(prescripcionFiltro);
            });
        }

        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="10" class="table-empty">No hay registros.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.forEach((item) => {
            const row = document.createElement('tr');

            const productoNombre = item.dim_producto?.nombre_2 || item.concentracion || 'N/A';
            const confirmada = Array.isArray(item.ventas_kv_confirmadas) && item.ventas_kv_confirmadas.length
                ? item.ventas_kv_confirmadas[0]
                : null;

            if (savedOnly && !confirmada) {
                return;
            }

            if (pendingOnly && confirmada) {
                return;
            }

            const prescripcion = item.prescripcion || item.fecha_prescripcion || '';
            const cells = [
                prescripcion || 'N/A',
                item.cedula_cliente || 'N/A',
                item.telefono || 'N/A',
                item.mascota || 'N/A',
                productoNombre
            ];

            cells.forEach((value) => {
                const td = document.createElement('td');
                td.textContent = value;
                row.appendChild(td);
            });

            const qtyCell = document.createElement('td');
            qtyCell.className = 'cell-qty';
            const qtyValue = confirmada?.cantidad ? String(confirmada.cantidad) : '1';
            const qtySelect = buildQtySelect(qtyValue);
            qtyCell.appendChild(qtySelect);
            row.appendChild(qtyCell);

            const montoDefault = getMontoDefault(productoNombre);
            const hasMontoValue = (value) => value !== null && value !== undefined && value !== '';

            const ventaAmountCell = document.createElement('td');
            const ventaAmountInput = document.createElement('input');
            ventaAmountInput.type = 'number';
            ventaAmountInput.min = '0';
            ventaAmountInput.step = '1';
            ventaAmountInput.className = 'cell-input';
            ventaAmountInput.placeholder = 'Monto';
            if (hasMontoValue(confirmada?.monto_venta)) {
                ventaAmountInput.value = String(confirmada.monto_venta);
            } else if (hasMontoValue(confirmada?.monto_pagado)) {
                ventaAmountInput.value = String(confirmada.monto_pagado);
            } else if (!confirmada && montoDefault) {
                ventaAmountInput.value = String(montoDefault);
            }
            ventaAmountInput.addEventListener('input', () => {
                ventaAmountInput.value = ventaAmountInput.value.replace(/[^0-9]/g, '');
            });
            ventaAmountCell.appendChild(ventaAmountInput);
            row.appendChild(ventaAmountCell);

            const amountCell = document.createElement('td');
            const amountInput = document.createElement('input');
            amountInput.type = 'number';
            amountInput.min = '0';
            amountInput.step = '1';
            amountInput.className = 'cell-input';
            amountInput.placeholder = 'Monto';
            if (hasMontoValue(confirmada?.monto_pagado)) {
                amountInput.value = String(confirmada.monto_pagado);
            } else if (!confirmada && montoDefault) {
                amountInput.value = String(montoDefault);
            }
            amountInput.addEventListener('input', () => {
                amountInput.value = amountInput.value.replace(/[^0-9]/g, '');
            });
            amountCell.appendChild(amountInput);
            row.appendChild(amountCell);

            const paymentCell = document.createElement('td');
            const paymentValue = confirmada?.metodo_pago || defaultPayment;
            const paymentSelect = buildSelect(paymentOptions, 'cell-select', null, paymentValue);
            paymentCell.appendChild(paymentSelect);
            row.appendChild(paymentCell);

            const saveCell = document.createElement('td');
            const saveButton = document.createElement('button');
            saveButton.type = 'button';
            saveButton.className = 'btn-save';
            saveButton.textContent = 'No confirmado';
            if (confirmada) {
                saveButton.disabled = true;
                saveButton.textContent = 'Confirmado';
            }

            const markDirty = () => {
                if (!confirmada) return;
                saveButton.disabled = false;
                saveButton.textContent = 'No confirmado';
            };

            qtySelect.addEventListener('change', markDirty);
            amountInput.addEventListener('input', markDirty);
            ventaAmountInput.addEventListener('input', markDirty);
            paymentSelect.addEventListener('change', markDirty);

            saveButton.addEventListener('click', async () => {
                const payload = {
                    venta_tutor_id: item.id,
                    cedula_cliente: item.cedula_cliente || null,
                    veterinario: item.veterinario || null,
                    telefono: item.telefono || null,
                    mascota: item.mascota || null,
                    tipo_de_venta: item.tipo_de_venta || null,
                    concentracion: item.concentracion || null,
                    producto: productoNombre || null,
                    fecha_prescripcion: item.fecha_prescripcion || null,
                    cantidad: qtySelect.value || '1',
                    monto_venta: ventaAmountInput.value || null,
                    monto_pagado: amountInput.value || null,
                    metodo_pago: paymentSelect.value || null
                };

                if (!payload.metodo_pago) {
                    alert('Selecciona el metodo de pago.');
                    return;
                }

                try {
                    const isUpdate = Boolean(confirmada?.id);
                    const endpoint = isUpdate
                        ? `${API_BASE_URL}/confirmadas/${confirmada.id}`
                        : `${API_BASE_URL}/confirmadas`;
                    const saveResponse = await fetch(endpoint, {
                        method: isUpdate ? 'PUT' : 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(payload)
                    });

                    const result = await saveResponse.json();
                    if (!saveResponse.ok) {
                        alert(`Error al guardar: ${result.message || 'No se pudo guardar.'}`);
                        return;
                    }

                    const confirmadaId = result?.data?.id;
                    if (confirmadaId) {
                        const montoVenta = ventaAmountInput.value ? Number(ventaAmountInput.value) : null;
                        const montoPagado = amountInput.value ? Number(amountInput.value) : null;
                        const saldoPendiente = result?.data?.saldo_pendiente !== undefined
                            ? result.data.saldo_pendiente
                            : (montoVenta !== null && montoPagado !== null ? montoVenta - montoPagado : null);

                        const creditosPayload = {
                            venta_confirmada_id: confirmadaId,
                            venta_tutor_id: item.id,
                            fecha_venta: result?.data?.created_at || item.created_at || null,
                            cedula_cliente: item.cedula_cliente || null,
                            telefono: item.telefono || null,
                            nombre_cliente: item.nombre_cliente || null,
                            veterinario: item.veterinario || null,
                            producto: productoNombre || null,
                            metodo_pago: paymentSelect.value || null,
                            tipo_de_venta: item.tipo_de_venta || null,
                            fecha_prescripcion: item.fecha_prescripcion || null,
                            saldo_pendiente: saldoPendiente,
                            estado_credito: 'P. Pago'
                        };

                        const creditosResponse = await fetch(`${CREDITOS_VETS_API_BASE_URL}/${confirmadaId}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify(creditosPayload)
                        });

                        const creditosResult = await creditosResponse.json();
                        if (!creditosResponse.ok) {
                            alert(`Guardado venta, pero no se pudo guardar el credito: ${creditosResult.message || 'Error.'}`);
                            return;
                        }

                        const metodoPago = normalizeValue(paymentSelect.value || '');
                        const pagoInicial = montoPagado !== null ? Number(montoPagado) : 0;
                        if (!isUpdate && metodoPago === normalizeValue('Credito') && pagoInicial > 0) {
                            const recaudoPayload = {
                                venta_confirmada_id: confirmadaId,
                                venta_tutor_id: item.id,
                                tipo_recaudo: 'Abono',
                                monto: 0,
                                pago_inicial: pagoInicial,
                                saldo_pendiente: null,
                                fecha_recaudo: result?.data?.created_at || new Date().toISOString()
                            };

                            const recaudoResponse = await fetch(RECAUDO_VETS_API_BASE_URL, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify(recaudoPayload)
                            });

                            if (!recaudoResponse.ok) {
                                const recaudoResult = await recaudoResponse.json();
                                alert(`Venta guardada, pero no se pudo registrar el pago inicial: ${recaudoResult.message || 'Error.'}`);
                                return;
                            }
                        }

                    }

                    saveButton.disabled = true;
                    saveButton.textContent = 'Confirmado';
                } catch (error) {
                    console.error('Error al guardar venta:', error);
                    alert('Error de conexion al guardar.');
                }
            });
            saveCell.appendChild(saveButton);
            row.appendChild(saveCell);

            row.dataset.saved = confirmada ? 'true' : 'false';
            tbody.appendChild(row);
        });

        if (!tbody.children.length) {
            tbody.innerHTML = '<tr><td colspan="10" class="table-empty">No hay registros.</td></tr>';
        }
    } catch (error) {
        console.error('Error al cargar ventas:', error);
        tbody.innerHTML = '<tr><td colspan="10" class="table-empty">Error de conexion.</td></tr>';
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

    const dateInput = document.getElementById('filter-date');
    const btnApply = document.getElementById('btn-filter-date');
    const btnClear = document.getElementById('btn-clear');
    const btnSaved = document.getElementById('btn-filter-saved');
    const btnPending = document.getElementById('btn-filter-pending');
    const presetButtons = document.querySelectorAll('[data-preset]');
    const prescripcionInput = document.getElementById('filter-prescripcion');
    let savedOnly = false;
    let pendingOnly = true;

    function setActivePreset(activeButton) {
        presetButtons.forEach((btn) => btn.classList.remove('active'));
        if (activeButton) activeButton.classList.add('active');
    }

    btnApply.addEventListener('click', () => {
        const date = dateInput.value;
        const prescripcion = prescripcionInput.value.trim();
        setActivePreset(null);
        loadVentas({ token, date, prescripcion, savedOnly, pendingOnly });
    });

    btnClear.addEventListener('click', () => {
        dateInput.value = '';
        prescripcionInput.value = '';
        setActivePreset(null);
        savedOnly = false;
        pendingOnly = false;
        btnSaved.classList.remove('active');
        btnPending.classList.remove('active');
        loadVentas({ token, prescripcion: null, savedOnly, pendingOnly });
    });

    presetButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const preset = btn.getAttribute('data-preset');
            setActivePreset(btn);
            dateInput.value = '';
            prescripcionInput.value = '';
            loadVentas({ token, preset, prescripcion: null, savedOnly, pendingOnly });
        });
    });

    btnSaved.addEventListener('click', () => {
        savedOnly = !savedOnly;
        btnSaved.classList.toggle('active', savedOnly);
        if (savedOnly) {
            pendingOnly = false;
            btnPending.classList.remove('active');
        }
        loadVentas({
            token,
            preset: null,
            date: dateInput.value || null,
            prescripcion: prescripcionInput.value.trim(),
            savedOnly,
            pendingOnly
        });
    });

    btnPending.addEventListener('click', () => {
        pendingOnly = !pendingOnly;
        btnPending.classList.toggle('active', pendingOnly);
        if (pendingOnly) {
            savedOnly = false;
            btnSaved.classList.remove('active');
        }
        loadVentas({
            token,
            preset: null,
            date: dateInput.value || null,
            prescripcion: prescripcionInput.value.trim(),
            savedOnly,
            pendingOnly
        });
    });

    btnPending.classList.add('active');
    loadVentas({ token, prescripcion: null, savedOnly, pendingOnly });
});
