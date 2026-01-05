const XLSX = require('xlsx');
const { supabaseAdmin } = require('../config/supabase');

function formatPreConfirmadoDate(value) {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toISOString().split('T')[0];
}

function buildPreConfirmadoText(confirmadas) {
    if (!Array.isArray(confirmadas) || !confirmadas.length) {
        return 'No encontrado';
    }

    return confirmadas.map((item) => {
        const producto = item.producto || 'N/A';
        const cantidad = item.cantidad !== null && item.cantidad !== undefined ? item.cantidad : 'N/A';
        const metodo = item.metodo_pago || 'N/A';
        const fecha = formatPreConfirmadoDate(item.created_at);
        const saldo = item.saldo_pendiente !== null && item.saldo_pendiente !== undefined
            ? item.saldo_pendiente
            : 'N/A';
        return `Producto: ${producto} | Cantidad: ${cantidad} | Metodo: ${metodo} | Fecha: ${fecha} | Saldo: ${saldo}`;
    }).join(' / ');
}

async function updatePreConfirmadoForDoc(cedulaCliente) {
    if (!cedulaCliente) {
        return { updated: 0 };
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const startIso = monthStart.toISOString();
    const endIso = now.toISOString();

    const { data: preventas, error: preventasError } = await supabaseAdmin
        .from('preventascall')
        .select('id')
        .eq('num_doc', cedulaCliente)
        .gte('fechapreventa', startIso)
        .lte('fechapreventa', endIso);

    if (preventasError) {
        return { error: preventasError };
    }

    if (!preventas || !preventas.length) {
        return { updated: 0 };
    }

    const { data: confirmadas, error: confirmadasError } = await supabaseAdmin
        .from('ventas_kv_confirmadas')
        .select('producto, cantidad, metodo_pago, created_at, saldo_pendiente')
        .eq('cedula_cliente', cedulaCliente)
        .gte('created_at', startIso)
        .lte('created_at', endIso);

    if (confirmadasError) {
        return { error: confirmadasError };
    }

    const preConfirmado = buildPreConfirmadoText(confirmadas);

    const { error: updateError } = await supabaseAdmin
        .from('preventascall')
        .update({ pre_confirmado: preConfirmado })
        .eq('num_doc', cedulaCliente)
        .gte('fechapreventa', startIso)
        .lte('fechapreventa', endIso);

    if (updateError) {
        return { error: updateError };
    }

    return { updated: preventas.length, preConfirmado };
}

const REQUIRED_FIELDS = [
    'cedula_cliente',
    'nombre_cliente',
    'telefono',
    'direccion',
    'ciudad',
    'departamento',
    'veterinario',
    'concentracion',
    'fecha_prescripcion',
    'mascota',
    'tipo_de_venta'
];

const FIELD_ALIASES = new Map([
    ['cedulacliente', 'cedula_cliente'],
    ['cedula', 'cedula_cliente'],
    ['documento', 'cedula_cliente'],
    ['nombrecliente', 'nombre_cliente'],
    ['nombre', 'nombre_cliente'],
    ['telefono', 'telefono'],
    ['tel', 'telefono'],
    ['direccion', 'direccion'],
    ['ciudad', 'ciudad'],
    ['departamento', 'departamento'],
    ['correo', 'correo_electronico'],
    ['correoelectronico', 'correo_electronico'],
    ['email', 'correo_electronico'],
    ['veterinario', 'veterinario'],
    ['concentracion', 'concentracion'],
    ['fechaprescripcion', 'fecha_prescripcion'],
    ['fecha', 'fecha_prescripcion'],
    ['prescicpcion', 'prescripcion'],
    ['prescripcion', 'prescripcion'],
    ['mascota', 'mascota'],
    ['tipodeventa', 'tipo_de_venta'],
    ['tipoventa', 'tipo_de_venta']
]);

function normalizeHeader(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function normalizeText(value) {
    const text = String(value || '').trim();
    return text.length ? text : null;
}

function formatExcelDate(value) {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value.getTime())) {
        return value.toISOString().split('T')[0];
    }
    if (typeof value === 'number') {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (parsed && parsed.y && parsed.m && parsed.d) {
            const month = String(parsed.m).padStart(2, '0');
            const day = String(parsed.d).padStart(2, '0');
            return `${parsed.y}-${month}-${day}`;
        }
    }
    return normalizeText(value);
}

function mapRow(row, headerMap) {
    const mapped = {};
    Object.entries(row).forEach(([header, value]) => {
        const normalized = normalizeHeader(header);
        const fieldKey = headerMap.get(normalized);
        if (!fieldKey) return;
        mapped[fieldKey] = value;
    });
    return mapped;
}

function buildHeaderMap(headers) {
    const headerMap = new Map();
    headers.forEach((header) => {
        const normalized = normalizeHeader(header);
        const field = FIELD_ALIASES.get(normalized);
        if (field) {
            headerMap.set(normalized, field);
            return;
        }
        if (normalized.includes('prescripcion')) {
            headerMap.set(normalized, 'prescripcion');
        }
    });
    return headerMap;
}

exports.uploadVentasTutores = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Debe adjuntar un archivo de Excel.' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            return res.status(400).json({ message: 'El archivo no contiene hojas.' });
        }

        const worksheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        if (!rawRows.length) {
            return res.status(400).json({ message: 'El archivo no contiene registros.' });
        }

        const headers = Object.keys(rawRows[0] || {});
        const headerMap = buildHeaderMap(headers);
        if (!headerMap.size) {
            return res.status(400).json({ message: 'No se encontraron columnas validas en el archivo.' });
        }

        const rowsToInsert = [];
        const skippedRows = [];

        rawRows.forEach((row, index) => {
            const mapped = mapRow(row, headerMap);
            const payload = {
                cedula_cliente: normalizeText(mapped.cedula_cliente),
                nombre_cliente: normalizeText(mapped.nombre_cliente),
                telefono: normalizeText(mapped.telefono),
                direccion: normalizeText(mapped.direccion),
                ciudad: normalizeText(mapped.ciudad),
                departamento: normalizeText(mapped.departamento),
                correo_electronico: normalizeText(mapped.correo_electronico),
                veterinario: normalizeText(mapped.veterinario),
                concentracion: normalizeText(mapped.concentracion),
                prescripcion: normalizeText(mapped.prescripcion),
                fecha_prescripcion: formatExcelDate(mapped.fecha_prescripcion),
                mascota: normalizeText(mapped.mascota),
                tipo_de_venta: normalizeText(mapped.tipo_de_venta)
            };

            const missing = REQUIRED_FIELDS.filter((field) => !payload[field]);
            if (missing.length) {
                skippedRows.push({ row: index + 2, missing });
                return;
            }

            rowsToInsert.push(payload);
        });

        if (!rowsToInsert.length) {
            return res.status(400).json({
                message: 'No hay filas validas para insertar.',
                skipped: skippedRows
            });
        }

        const { data, error } = await supabaseAdmin
            .from('ventas_tutores')
            .insert(rowsToInsert)
            .select('id');

        if (error) {
            return res.status(500).json({ message: 'Error al guardar ventas.', error: error.message });
        }

        return res.status(201).json({
            message: 'Ventas cargadas correctamente.',
            inserted: data.length,
            skipped: skippedRows
        });
    } catch (error) {
        console.error('Error al cargar ventas:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

exports.getVentasTutores = async (req, res) => {
    try {
        const preset = String(req.query.preset || '').toLowerCase();
        const date = String(req.query.date || '');

        let query = supabaseAdmin
            .from('ventas_tutores')
            .select('id, cedula_cliente, nombre_cliente, telefono, mascota, concentracion, veterinario, prescripcion, fecha_prescripcion, tipo_de_venta, created_at, dim_producto(nombre_2), ventas_kv_confirmadas(id, cantidad, monto_venta, monto_pagado, saldo_pendiente, metodo_pago, tipo_de_venta, created_at)')
            .order('created_at', { ascending: false });

        if (preset || date) {
            let baseDate;
            if (preset === 'today') {
                baseDate = new Date();
            } else if (preset === 'yesterday') {
                baseDate = new Date();
                baseDate.setDate(baseDate.getDate() - 1);
            } else if (date) {
                baseDate = new Date(date);
            }

            if (baseDate && !isNaN(baseDate.getTime())) {
                const start = new Date(baseDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(start);
                end.setDate(end.getDate() + 1);
                query = query.gte('created_at', start.toISOString());
                query = query.lt('created_at', end.toISOString());
            }
        }

        const { data, error } = await query;
        if (error) {
            return res.status(500).json({ message: 'Error al obtener ventas.', error: error.message });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Error interno al listar ventas:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

exports.getVeterinarios = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('ventas_tutores')
            .select('veterinario')
            .not('veterinario', 'is', null);

        if (error) {
            return res.status(500).json({ message: 'Error al obtener veterinarios.', error: error.message });
        }

        const unique = Array.from(new Set(
            (data || [])
                .map((item) => String(item.veterinario || '').trim())
                .filter((value) => value)
        )).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

        return res.status(200).json(unique);
    } catch (error) {
        console.error('Error interno al listar veterinarios:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

exports.createVentaConfirmada = async (req, res) => {
    const {
        venta_tutor_id,
        cedula_cliente,
        telefono,
        veterinario,
        mascota,
        concentracion,
        producto,
        fecha_prescripcion,
        cantidad,
        monto_venta,
        monto_pagado,
        metodo_pago,
        tipo_de_venta
    } = req.body;

    if (!venta_tutor_id || !cantidad || !metodo_pago) {
        return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

    try {
        const payload = {
            venta_tutor_id,
            cedula_cliente: cedula_cliente || null,
            veterinario: veterinario || null,
            telefono: telefono || null,
            mascota: mascota || null,
            concentracion: concentracion || null,
            producto: producto || null,
            fecha_prescripcion: fecha_prescripcion || null,
            cantidad: Number(cantidad) || 1,
            monto_venta: monto_venta !== null && monto_venta !== '' && monto_venta !== undefined ? Number(monto_venta) : null,
            monto_pagado: monto_pagado !== null && monto_pagado !== '' && monto_pagado !== undefined ? Number(monto_pagado) : null,
            metodo_pago,
            tipo_de_venta: tipo_de_venta || null
        };
        const montoVentaValue = payload.monto_venta;
        const montoPagadoValue = payload.monto_pagado;
        payload.saldo_pendiente = montoVentaValue !== null && montoPagadoValue !== null
            ? montoVentaValue - montoPagadoValue
            : null;

        const { data, error } = await supabaseAdmin
            .from('ventas_kv_confirmadas')
            .insert([payload])
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: 'Error al guardar la venta.', error: error.message });
        }

        const preConfirmadoResult = await updatePreConfirmadoForDoc(payload.cedula_cliente);
        if (preConfirmadoResult?.error) {
            console.warn('No se pudo actualizar pre_confirmado:', preConfirmadoResult.error.message);
        }

        return res.status(201).json({ message: 'Venta confirmada guardada.', data });
    } catch (error) {
        console.error('Error interno al guardar venta confirmada:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

exports.updateVentaConfirmada = async (req, res) => {
    const { id } = req.params;
    const {
        cantidad,
        monto_venta,
        monto_pagado,
        metodo_pago,
        tipo_de_venta
    } = req.body;

    if (!id) {
        return res.status(400).json({ message: 'Falta el id de la venta confirmada.' });
    }

    if (!metodo_pago) {
        return res.status(400).json({ message: 'Debe indicar el metodo de pago.' });
    }

    try {
        const updates = {
            cantidad: Number(cantidad) || 1,
            monto_venta: monto_venta !== null && monto_venta !== '' && monto_venta !== undefined ? Number(monto_venta) : null,
            monto_pagado: monto_pagado !== null && monto_pagado !== '' && monto_pagado !== undefined ? Number(monto_pagado) : null,
            metodo_pago,
            tipo_de_venta: tipo_de_venta || null
        };
        const montoVentaValue = updates.monto_venta;
        const montoPagadoValue = updates.monto_pagado;
        updates.saldo_pendiente = montoVentaValue !== null && montoPagadoValue !== null
            ? montoVentaValue - montoPagadoValue
            : null;

        const { data, error } = await supabaseAdmin
            .from('ventas_kv_confirmadas')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: 'Error al actualizar la venta.', error: error.message });
        }

        const preConfirmadoResult = await updatePreConfirmadoForDoc(data?.cedula_cliente);
        if (preConfirmadoResult?.error) {
            console.warn('No se pudo actualizar pre_confirmado:', preConfirmadoResult.error.message);
        }

        return res.status(200).json({ message: 'Venta actualizada.', data });
    } catch (error) {
        console.error('Error interno al actualizar venta confirmada:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};
