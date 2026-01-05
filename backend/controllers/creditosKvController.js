const { supabaseAdmin } = require('../config/supabase');

function normalizeNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

// ------------------------------------------------------------------
// LISTAR CREDITOS TUTORES (GET /api/creditos_kv)
// ------------------------------------------------------------------
exports.getCreditosKv = async (req, res) => {
    try {
        const role = (req.userRole || '').trim().toLowerCase();
        const isAdmin = role === 'admin';
        const isDataVentas = role === 'datos y ventas klean vet';

        let query = supabaseAdmin
            .from('creditos_kv')
            .select('*')
            .order('fechapreventa', { ascending: false });

        if (!isAdmin && !isDataVentas) {
            query = query.eq('agente_id', req.user.id);
        }

        const { data, error } = await query;
        if (error) {
            return res.status(500).json({ message: 'Error al obtener creditos.', error: error.message });
        }

        return res.status(200).json(data || []);
    } catch (error) {
        console.error('Error interno al listar creditos:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// GUARDAR CREDITO TUTOR (PUT /api/creditos_kv/:preventaId)
// ------------------------------------------------------------------
exports.upsertCreditoKv = async (req, res) => {
    const { preventaId } = req.params;
    const {
        saldo_pendiente,
        estado_credito,
        fecha_paz_y_salvo,
        fechapreventa,
        num_doc,
        tel_contacto,
        nombre_tutor,
        metodo_pago,
        estado_preventa,
        agente_id
    } = req.body;

    if (!preventaId) {
        return res.status(400).json({ message: 'Falta el id de la preventa.' });
    }

    try {
        const payload = {
            preventa_id: preventaId,
            saldo_pendiente: normalizeNumber(saldo_pendiente),
            estado_credito: estado_credito || 'P. Pago'
        };

        if (fechapreventa !== undefined) payload.fechapreventa = fechapreventa;
        if (num_doc !== undefined) payload.num_doc = num_doc;
        if (tel_contacto !== undefined) payload.tel_contacto = tel_contacto;
        if (nombre_tutor !== undefined) payload.nombre_tutor = nombre_tutor;
        if (metodo_pago !== undefined) payload.metodo_pago = metodo_pago;
        if (estado_preventa !== undefined) payload.estado_preventa = estado_preventa;
        if (fecha_paz_y_salvo !== undefined) payload.fecha_paz_y_salvo = fecha_paz_y_salvo;
        if (agente_id !== undefined) payload.agente_id = agente_id;

        const { data, error } = await supabaseAdmin
            .from('creditos_kv')
            .upsert([payload], { onConflict: 'preventa_id' })
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: 'Error al guardar el credito.', error: error.message });
        }

        return res.status(200).json({ message: 'Credito actualizado.', data });
    } catch (error) {
        console.error('Error interno al guardar credito:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};
