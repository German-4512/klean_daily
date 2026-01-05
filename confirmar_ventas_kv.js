const API_BASE_URL = '/api/preventascall';
const CREDITOS_API_BASE_URL = '/api/creditos_kv';
const AUTH_BASE_URL = '/api/auth';

const productOptions = [
    '1% 15 Ml',
    '2% 15 Ml',
    '2% 30 Ml',
    '3% 100 Ml',
    'Gastro Plus',
    'Derma Plus',
    'Adulto Plus'
];

const paymentOptions = ['Decontado', 'Credito', 'Contra Entrega'];
const statusOptions = ['Pendiente confirmar', 'Confirmada', 'No Confirmada', 'Quitar'];

function normalizeValue(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function formatDateTime(value) {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

function buildSelect(options, className, placeholder, selectedValue) {
    const select = document.createElement('select');
    select.className = className;
    const normalizedSelected = normalizeValue(selectedValue);

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

function buildQtySelect(className, selectedValue) {
    const options = [1, 2, 3, 4, 5].map(String);
    return buildSelect(options, className, 'Seleccionar', selectedValue);
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

async function loadPreventas({ token, preset, date, pendingOnly, confirmedOnly }) {
    const tbody = document.getElementById('ventas-body');
    tbody.innerHTML = '<tr><td colspan="20" class="table-empty">Cargando preventas...</td></tr>';

    const params = new URLSearchParams();
    if (preset) params.append('preset', preset);
    if (date) params.append('date', date);
    params.append('all', 'true');

    try {
        const response = await fetch(`${API_BASE_URL}?${params.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        if (!response.ok) {
            tbody.innerHTML = `<tr><td colspan="20" class="table-empty">Error: ${data.message || 'No se pudo cargar.'}</td></tr>`;
            return;
        }

        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="20" class="table-empty">No hay registros.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.forEach((item) => {
            const row = document.createElement('tr');

            const estadoPreventa = item.estado_preventa || item.estado_preventa || 'Pendiente confirmar';
            const normalizedEstado = normalizeValue(estadoPreventa);

            if (pendingOnly && normalizedEstado !== normalizeValue('Pendiente confirmar')) {
                return;
            }

            if (confirmedOnly && normalizedEstado !== normalizeValue('Confirmada')) {
                return;
            }

            const cells = [
                formatDateTime(item.fechapreventa),
                formatDateTime(item.fechaatencion),
                item.nombre_paciente || 'N/A',
                item.nombre_tutor || 'N/A',
                item.num_doc || 'N/A',
                item.tel_contacto || 'N/A'
            ];

            cells.forEach((value) => {
                const td = document.createElement('td');
                td.textContent = value;
                row.appendChild(td);
            });

            for (let i = 1; i <= 4; i += 1) {
                const productCell = document.createElement('td');
                const productValue = item[`produc_${i}`] || item[`producto_${i}`] || '';
                const productSelect = buildSelect(productOptions, 'cell-select', 'Seleccionar', productValue);
                productCell.appendChild(productSelect);
                row.appendChild(productCell);

                const qtyCell = document.createElement('td');
                qtyCell.className = 'cell-qty';
                const qtyValue = item[`cant_${i}`] ? String(item[`cant_${i}`]) : '';
                const qtySelect = buildQtySelect('cell-select', qtyValue);
                qtyCell.appendChild(qtySelect);
                row.appendChild(qtyCell);
            }

            const paymentCell = document.createElement('td');
            const paymentSelect = buildSelect(paymentOptions, 'cell-select', 'Seleccionar', item.metodo_pago || item.metodoPago || '');
            paymentCell.appendChild(paymentSelect);
            row.appendChild(paymentCell);

            const saldoCell = document.createElement('td');
            const saldoInput = document.createElement('input');
            saldoInput.type = 'number';
            saldoInput.className = 'cell-input';
            saldoInput.min = '0';
            saldoInput.step = '0.01';
            saldoInput.placeholder = '0';
            saldoInput.value = item.saldo_pendiente !== null && item.saldo_pendiente !== undefined
                ? String(item.saldo_pendiente)
                : '';
            saldoCell.appendChild(saldoInput);
            row.appendChild(saldoCell);

            const statusCell = document.createElement('td');
            const statusValue = estadoPreventa;
            const statusSelect = buildSelect(statusOptions, 'cell-select', null, statusValue);
            statusCell.appendChild(statusSelect);
            statusCell.classList.toggle('status-pending', normalizeValue(statusValue) === normalizeValue('Pendiente confirmar'));
            statusSelect.addEventListener('change', () => {
                statusCell.classList.toggle('status-pending', normalizeValue(statusSelect.value) === normalizeValue('Pendiente confirmar'));
            });
            row.appendChild(statusCell);

            const preConfirmadoCell = document.createElement('td');
            const preConfirmadoInput = document.createElement('input');
            preConfirmadoInput.type = 'text';
            preConfirmadoInput.className = 'cell-input pre-confirmado-input';
            preConfirmadoInput.placeholder = 'Pre Confirmado';
            preConfirmadoInput.value = item.pre_confirmado || '';
            preConfirmadoInput.readOnly = true;
            preConfirmadoCell.appendChild(preConfirmadoInput);
            row.appendChild(preConfirmadoCell);

            const notasCell = document.createElement('td');
            const notasInput = document.createElement('input');
            notasInput.type = 'text';
            notasInput.className = 'cell-input';
            notasInput.placeholder = 'Notas';
            notasInput.value = item.notas || '';
            notasCell.appendChild(notasInput);
            row.appendChild(notasCell);

            const saveCell = document.createElement('td');
            const saveButton = document.createElement('button');
            saveButton.type = 'button';
            saveButton.className = 'btn-save';
            saveButton.textContent = 'Guardar';
            saveButton.addEventListener('click', async () => {
                const selectedStatus = row.children[16].querySelector('select')?.value || '';
                if (normalizeValue(selectedStatus) === normalizeValue('Quitar')) {
                    try {
                        const deleteResponse = await fetch(`${API_BASE_URL}/${item.id}`, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });

                        const deleteResult = await deleteResponse.json();
                        if (!deleteResponse.ok) {
                            alert(`Error al eliminar: ${deleteResult.message || 'No se pudo eliminar.'}`);
                            return;
                        }

                        row.remove();
                        if (!tbody.children.length) {
                            tbody.innerHTML = '<tr><td colspan="20" class="table-empty">No hay registros.</td></tr>';
                        }
                        return;
                    } catch (error) {
                        console.error('Error al eliminar preventa:', error);
                        alert('Error de conexión al eliminar.');
                        return;
                    }
                }

                const saldoRaw = row.children[15].querySelector('input')?.value ?? '';
                const saldoValue = saldoRaw === '' ? null : Number(saldoRaw);
                if (saldoRaw !== '' && !Number.isFinite(saldoValue)) {
                    alert('El saldo pendiente debe ser un numero valido.');
                    return;
                }

                const payload = {
                    produc_1: row.children[6].querySelector('select')?.value || null,
                    cant_1: row.children[7].querySelector('select')?.value || null,
                    produc_2: row.children[8].querySelector('select')?.value || null,
                    cant_2: row.children[9].querySelector('select')?.value || null,
                    produc_3: row.children[10].querySelector('select')?.value || null,
                    cant_3: row.children[11].querySelector('select')?.value || null,
                    produc_4: row.children[12].querySelector('select')?.value || null,
                    cant_4: row.children[13].querySelector('select')?.value || null,
                    metodo_pago: row.children[14].querySelector('select')?.value || null,
                    saldo_pendiente: saldoValue,
                    estado_preventa: row.children[16].querySelector('select')?.value || null,
                    notas: row.children[18].querySelector('input')?.value || null
                };

                for (let i = 1; i <= 4; i += 1) {
                    const productValue = (payload[`produc_${i}`] || '').trim();
                    const qtyValue = payload[`cant_${i}`];
                    const qtyNumber = Number(qtyValue);
                    const hasQty = qtyValue !== null && qtyValue !== '' && Number.isFinite(qtyNumber) && qtyNumber > 0;

                    if (productValue && !hasQty) {
                        alert(`Debes indicar la cantidad para el Producto ${i}.`);
                        return;
                    }

                    if (!productValue && hasQty) {
                        alert(`Debes seleccionar un producto para la Cantidad ${i}.`);
                        return;
                    }
                }

                try {
                    const updateResponse = await fetch(`${API_BASE_URL}/${item.id}`, {
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

                    const creditosPayload = {
                        preventa_id: item.id,
                        fechapreventa: item.fechapreventa || null,
                        num_doc: item.num_doc || null,
                        tel_contacto: item.tel_contacto || null,
                        nombre_tutor: item.nombre_tutor || null,
                        metodo_pago: payload.metodo_pago,
                        estado_preventa: payload.estado_preventa,
                        saldo_pendiente: saldoValue,
                        estado_credito: item.estado_credito || 'P. Pago',
                        agente_id: item.agente_id || null
                    };

                    const creditosResponse = await fetch(`${CREDITOS_API_BASE_URL}/${item.id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(creditosPayload)
                    });

                    const creditosResult = await creditosResponse.json();
                    if (!creditosResponse.ok) {
                        alert(`Guardado preventa, pero no se pudo guardar el credito: ${creditosResult.message || 'Error.'}`);
                        return;
                    }

                    alert('Guardado correctamente.');
                } catch (error) {
                    console.error('Error al guardar preventa:', error);
                    alert('Error de conexión al guardar.');
                }
            });
            saveCell.appendChild(saveButton);
            row.appendChild(saveCell);

            tbody.appendChild(row);
        });

        if (!tbody.children.length) {
            tbody.innerHTML = '<tr><td colspan="20" class="table-empty">No hay registros.</td></tr>';
        }
    } catch (error) {
        console.error('Error al cargar preventas:', error);
        tbody.innerHTML = '<tr><td colspan="20" class="table-empty">Error de conexión.</td></tr>';
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
    const btnPending = document.getElementById('btn-filter-pending');
    const btnConfirmed = document.getElementById('btn-filter-confirmed');
    const presetButtons = document.querySelectorAll('[data-preset]');
    let pendingOnly = true;
    let confirmedOnly = false;

    function setActivePreset(activeButton) {
        presetButtons.forEach((btn) => btn.classList.remove('active'));
        if (activeButton) activeButton.classList.add('active');
    }

    btnApply.addEventListener('click', () => {
        const date = dateInput.value;
        setActivePreset(null);
        loadPreventas({ token, date, pendingOnly, confirmedOnly });
    });

    btnClear.addEventListener('click', () => {
        dateInput.value = '';
        setActivePreset(null);
        pendingOnly = false;
        confirmedOnly = false;
        btnPending.classList.remove('active');
        btnConfirmed.classList.remove('active');
        loadPreventas({ token, pendingOnly, confirmedOnly });
    });

    presetButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const preset = btn.getAttribute('data-preset');
            setActivePreset(btn);
            dateInput.value = '';
            loadPreventas({ token, preset, pendingOnly, confirmedOnly });
        });
    });

    btnPending.addEventListener('click', () => {
        pendingOnly = !pendingOnly;
        btnPending.classList.toggle('active', pendingOnly);
        if (pendingOnly) {
            confirmedOnly = false;
            btnConfirmed.classList.remove('active');
        }
        loadPreventas({ token, preset: null, date: dateInput.value || null, pendingOnly, confirmedOnly });
    });

    btnConfirmed.addEventListener('click', () => {
        confirmedOnly = !confirmedOnly;
        btnConfirmed.classList.toggle('active', confirmedOnly);
        if (confirmedOnly) {
            pendingOnly = false;
            btnPending.classList.remove('active');
        }
        loadPreventas({ token, preset: null, date: dateInput.value || null, pendingOnly, confirmedOnly });
    });

    btnPending.classList.add('active');
    loadPreventas({ token, pendingOnly, confirmedOnly });
});
