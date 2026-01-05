const { supabaseAdmin } = require('../config/supabase');

function normalizeNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

// ------------------------------------------------------------------
// LISTAR CREDITOS VETS (GET /api/creditos_vets)
// ------------------------------------------------------------------
exports.getCreditosVets = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('creditos_vets')
            .select('*')
            .order('fecha_venta', { ascending: false });

        if (error) {
            return res.status(500).json({ message: 'Error al obtener creditos.', error: error.message });
        }

        return res.status(200).json(data || []);
    } catch (error) {
        console.error('Error interno al listar creditos vets:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// GUARDAR CREDITO VETS (PUT /api/creditos_vets/:ventaConfirmadaId)
// ------------------------------------------------------------------
exports.upsertCreditoVets = async (req, res) => {
    const { ventaConfirmadaId } = req.params;
    const {
        venta_tutor_id,
        saldo_pendiente,
        estado_credito,
        fecha_venta,
        cedula_cliente,
        telefono,
        nombre_cliente,
        veterinario,
        producto,
        metodo_pago,
        tipo_de_venta,
        fecha_prescripcion
    } = req.body;

    if (!ventaConfirmadaId) {
        return res.status(400).json({ message: 'Falta el id de la venta confirmada.' });
    }

    try {
        const payload = {
            venta_confirmada_id: ventaConfirmadaId,
            saldo_pendiente: normalizeNumber(saldo_pendiente),
            estado_credito: estado_credito || 'P. Pago'
        };

        if (venta_tutor_id !== undefined) payload.venta_tutor_id = venta_tutor_id;
        if (fecha_venta !== undefined) payload.fecha_venta = fecha_venta;
        if (cedula_cliente !== undefined) payload.cedula_cliente = cedula_cliente;
        if (telefono !== undefined) payload.telefono = telefono;
        if (nombre_cliente !== undefined) payload.nombre_cliente = nombre_cliente;
        if (veterinario !== undefined) payload.veterinario = veterinario;
        if (producto !== undefined) payload.producto = producto;
        if (metodo_pago !== undefined) payload.metodo_pago = metodo_pago;
        if (tipo_de_venta !== undefined) payload.tipo_de_venta = tipo_de_venta;
        if (fecha_prescripcion !== undefined) payload.fecha_prescripcion = fecha_prescripcion;

        const { data, error } = await supabaseAdmin
            .from('creditos_vets')
            .upsert([payload], { onConflict: 'venta_confirmada_id' })
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: 'Error al guardar el credito.', error: error.message });
        }

        return res.status(200).json({ message: 'Credito actualizado.', data });
    } catch (error) {
        console.error('Error interno al guardar credito vets:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};
