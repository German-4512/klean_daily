const { supabaseAdmin } = require('../config/supabase');

const normalizeText = (value) => {
    const text = String(value || '').trim();
    return text.length ? text : null;
};

const parseLocalDate = (value) => {
    if (!value) return null;
    const parts = String(value).split('-').map((item) => Number(item));
    if (parts.length !== 3) return null;
    const [year, month, day] = parts;
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? null : date;
};

const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const normalizeLocalDateTime = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
        if (isNaN(value.getTime())) return null;
        const localDate = formatLocalDate(value);
        const hours = String(value.getHours()).padStart(2, '0');
        const minutes = String(value.getMinutes()).padStart(2, '0');
        const seconds = String(value.getSeconds()).padStart(2, '0');
        return `${localDate}T${hours}:${minutes}:${seconds}`;
    }
    if (typeof value === 'number') {
        const date = new Date(value);
        if (isNaN(date.getTime())) return null;
        const localDate = formatLocalDate(date);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${localDate}T${hours}:${minutes}:${seconds}`;
    }
    const text = String(value).trim();
    if (!text) return null;
    if (/Z$|[+-]\d{2}:?\d{2}$/.test(text) || /\.\d{3}$/.test(text)) {
        const date = new Date(text);
        if (isNaN(date.getTime())) return null;
        const localDate = formatLocalDate(date);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${localDate}T${hours}:${minutes}:${seconds}`;
    }
    const match = text.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{3})?$/);
    if (!match) return null;
    const datePart = match[1];
    const hours = match[2];
    const minutes = match[3];
    const seconds = match[4] || '00';
    return `${datePart}T${hours}:${minutes}:${seconds}`;
};

const addDaysToDate = (date, days) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
};

const checkConflicts = async (medico, startValue, endValue, excludeId) => {
    if (!medico || !startValue || !endValue) {
        return { data: [] };
    }

    let query = supabaseAdmin
        .from('citas_klean_vet')
        .select('id_cita, cliente_id, fecha_inicio, fecha_fin')
        .eq('medico_veterinario', medico)
        .lt('fecha_inicio', endValue)
        .gt('fecha_fin', startValue);

    if (excludeId) {
        query = query.neq('id_cita', excludeId);
    }

    const { data, error } = await query;
    if (error) return { error };
    return { data: data || [] };
};

// ------------------------------------------------------------------
// LISTAR CITAS (GET /api/citas_klean_vet)
// ------------------------------------------------------------------
exports.getCitas = async (req, res) => {
    try {
        const date = String(req.query.date || '');
        const vet = normalizeText(req.query.vet);
        const status = normalizeText(req.query.status);

        let query = supabaseAdmin
            .from('citas_klean_vet')
            .select('*')
            .order('fecha_inicio', { ascending: true });

        if (date) {
            const base = parseLocalDate(date);
            if (base) {
                const startDate = formatLocalDate(base);
                const endDate = formatLocalDate(addDaysToDate(base, 1));
                query = query.gte('fecha_inicio', `${startDate}T00:00:00`);
                query = query.lt('fecha_inicio', `${endDate}T00:00:00`);
            }
        }

        if (vet) {
            query = query.eq('medico_veterinario', vet);
        }

        if (status) {
            query = query.eq('estado', status);
        }

        const { data, error } = await query;
        if (error) {
            return res.status(500).json({ message: 'Error al obtener citas.', error: error.message });
        }

        if (!data || !data.length) {
            return res.status(200).json([]);
        }

        const clienteIds = Array.from(new Set(
            data.map((item) => item.cliente_id).filter((id) => id !== null && id !== undefined)
        ));

        if (!clienteIds.length) {
            return res.status(200).json(data);
        }

        const { data: clientes, error: clientesError } = await supabaseAdmin
            .from('clientes_klean_vet')
            .select('id_cliente, nombre, apellido, nombre_mascota')
            .in('id_cliente', clienteIds);

        if (clientesError) {
            return res.status(500).json({ message: 'Error al obtener clientes.', error: clientesError.message });
        }

        const clientesMap = new Map((clientes || []).map((item) => [
            item.id_cliente,
            {
                cliente_nombre: item.nombre || null,
                cliente_apellido: item.apellido || null,
                cliente_mascota: item.nombre_mascota || null
            }
        ]));

        const response = data.map((item) => ({
            ...item,
            ...(clientesMap.get(item.cliente_id) || {})
        }));

        return res.status(200).json(response);
    } catch (error) {
        console.error('Error interno al listar citas:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// CREAR CITA (POST /api/citas_klean_vet)
// ------------------------------------------------------------------
exports.createCita = async (req, res) => {
    const {
        cliente_id,
        medico_veterinario,
        tipo_atencion,
        fecha_inicio,
        fecha_fin,
        estado,
        asesor
    } = req.body || {};

    if (!cliente_id || !medico_veterinario || !tipo_atencion || !fecha_inicio || !fecha_fin) {
        return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

        const inicio = new Date(fecha_inicio);
        const fin = new Date(fecha_fin);
        if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
            return res.status(400).json({ message: 'Fechas invalidas.' });
        }
        if (fin <= inicio) {
            return res.status(400).json({ message: 'La fecha fin debe ser posterior al inicio.' });
        }

        const inicioValue = normalizeLocalDateTime(fecha_inicio);
        const finValue = normalizeLocalDateTime(fecha_fin);
        if (!inicioValue || !finValue) {
            return res.status(400).json({ message: 'Formato de fecha invalido.' });
        }

        try {
            const payload = {
                cliente_id,
                medico_veterinario: normalizeText(medico_veterinario),
                tipo_atencion: normalizeText(tipo_atencion),
                fecha_inicio: inicioValue,
                fecha_fin: finValue,
                estado: normalizeText(estado) || 'Sin atender',
                asesor: normalizeText(asesor),
                agente_id: req.user?.id || null
            };

        const { data, error } = await supabaseAdmin
            .from('citas_klean_vet')
            .insert([payload])
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: 'Error al guardar la cita.', error: error.message });
        }

        const conflictsResult = await checkConflicts(
            payload.medico_veterinario,
            payload.fecha_inicio,
            payload.fecha_fin,
            data?.id_cita
        );
        if (conflictsResult?.error) {
            console.warn('No se pudo validar conflictos de cita:', conflictsResult.error.message);
        }
        const conflicts = conflictsResult?.data || [];

        return res.status(201).json({
            message: 'Cita creada correctamente.',
            data,
            warning: {
                hasConflict: conflicts.length > 0,
                count: conflicts.length,
                medico: payload.medico_veterinario || null,
                conflicts
            }
        });
    } catch (error) {
        console.error('Error interno al crear cita:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// ACTUALIZAR CITA (PUT /api/citas_klean_vet/:id)
// ------------------------------------------------------------------
exports.updateCita = async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'Id requerido.' });
    }

    const {
        medico_veterinario,
        tipo_atencion,
        fecha_inicio,
        fecha_fin,
        estado
    } = req.body || {};

    const updates = {};
    if (medico_veterinario !== undefined) updates.medico_veterinario = normalizeText(medico_veterinario);
    if (tipo_atencion !== undefined) updates.tipo_atencion = normalizeText(tipo_atencion);
    if (estado !== undefined) updates.estado = normalizeText(estado);

        if (fecha_inicio !== undefined || fecha_fin !== undefined) {
            if (!fecha_inicio || !fecha_fin) {
                return res.status(400).json({ message: 'Debe indicar fecha inicio y fin.' });
            }
            const inicio = new Date(fecha_inicio);
            const fin = new Date(fecha_fin);
            if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
                return res.status(400).json({ message: 'Fechas invalidas.' });
            }
            if (fin <= inicio) {
                return res.status(400).json({ message: 'La fecha fin debe ser posterior al inicio.' });
            }
            const inicioValue = normalizeLocalDateTime(fecha_inicio);
            const finValue = normalizeLocalDateTime(fecha_fin);
            if (!inicioValue || !finValue) {
                return res.status(400).json({ message: 'Formato de fecha invalido.' });
            }
            updates.fecha_inicio = inicioValue;
            updates.fecha_fin = finValue;
        }

    if (!Object.keys(updates).length) {
        return res.status(400).json({ message: 'No hay datos para actualizar.' });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('citas_klean_vet')
            .update(updates)
            .eq('id_cita', id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: 'Error al actualizar la cita.', error: error.message });
        }

        if (!data) {
            return res.status(404).json({ message: 'Cita no encontrada.' });
        }

        const conflictsResult = await checkConflicts(
            data?.medico_veterinario,
            data?.fecha_inicio,
            data?.fecha_fin,
            data?.id_cita
        );
        if (conflictsResult?.error) {
            console.warn('No se pudo validar conflictos de cita:', conflictsResult.error.message);
        }
        const conflicts = conflictsResult?.data || [];

        return res.status(200).json({
            message: 'Cita actualizada correctamente.',
            data,
            warning: {
                hasConflict: conflicts.length > 0,
                count: conflicts.length,
                medico: data?.medico_veterinario || null,
                conflicts
            }
        });
    } catch (error) {
        console.error('Error interno al actualizar cita:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// ELIMINAR CITA (DELETE /api/citas_klean_vet/:id)
// ------------------------------------------------------------------
exports.deleteCita = async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'Id requerido.' });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('citas_klean_vet')
            .delete()
            .eq('id_cita', id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: 'Error al eliminar la cita.', error: error.message });
        }

        if (!data) {
            return res.status(404).json({ message: 'Cita no encontrada.' });
        }

        return res.status(200).json({ message: 'Cita eliminada.', data });
    } catch (error) {
        console.error('Error interno al eliminar cita:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};
