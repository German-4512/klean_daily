const { supabaseAdmin } = require('../config/supabase');

const ALLOWED_TIPOS = new Set(['primera_vez', 'seguimiento', 'preventa']);

function normalizeText(value) {
    const text = String(value || '').trim();
    return text.length ? text : null;
}

function normalizeTipoVenta(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return null;
    if (raw.includes('primera')) return 'primera_vez';
    if (raw.includes('seguimiento')) return 'seguimiento';
    if (raw.includes('preventa') || raw.includes('pre venta')) return 'preventa';
    return raw;
}

function normalizeDate(value) {
    const date = value ? new Date(value) : new Date();
    if (isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
}

exports.getRendimientoDaily = async (req, res) => {
    try {
        const fecha = normalizeDate(req.query.date);
        if (!fecha) {
            return res.status(400).json({ message: 'Fecha inválida.' });
        }

        const { data, error } = await supabaseAdmin
            .from('rendimiento_daily')
            .select('*')
            .eq('fecha', fecha)
            .order('persona', { ascending: true });

        if (error) {
            return res.status(500).json({ message: 'Error al obtener rendimiento daily.', error: error.message });
        }

        return res.status(200).json({ fecha, data: data || [] });
    } catch (error) {
        console.error('Error interno al listar rendimiento daily:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

exports.updateRendimientoDaily = async (req, res) => {
    const persona = normalizeText(req.body.persona);
    const veterinario = normalizeText(req.body.veterinario);
    const tipoVenta = normalizeTipoVenta(req.body.tipo_venta);
    const fecha = normalizeDate(req.body.fecha);
    const delta = Number(req.body.delta);

    if (!persona || !veterinario || !tipoVenta || !fecha) {
        return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

    if (!ALLOWED_TIPOS.has(tipoVenta)) {
        return res.status(400).json({ message: 'Tipo de venta inválido.' });
    }

    if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
        return res.status(400).json({ message: 'Delta inválido. Debe ser un entero distinto de 0.' });
    }

    try {
        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('rendimiento_daily')
            .select('id, cantidad')
            .eq('fecha', fecha)
            .eq('persona', persona)
            .eq('tipo_venta', tipoVenta)
            .eq('veterinario', veterinario)
            .maybeSingle();

        if (fetchError) {
            return res.status(500).json({ message: 'Error al consultar rendimiento daily.', error: fetchError.message });
        }

        const nextCantidad = Math.max(0, (existing?.cantidad || 0) + delta);

        if (existing?.id) {
            const { data, error } = await supabaseAdmin
                .from('rendimiento_daily')
                .update({
                    cantidad: nextCantidad,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) {
                return res.status(500).json({ message: 'Error al actualizar rendimiento daily.', error: error.message });
            }

            return res.status(200).json({ message: 'Actualizado.', data });
        }

        const { data, error } = await supabaseAdmin
            .from('rendimiento_daily')
            .insert([{
                fecha,
                persona,
                tipo_venta: tipoVenta,
                veterinario,
                cantidad: nextCantidad
            }])
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: 'Error al guardar rendimiento daily.', error: error.message });
        }

        return res.status(201).json({ message: 'Creado.', data });
    } catch (error) {
        console.error('Error interno al actualizar rendimiento daily:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};
