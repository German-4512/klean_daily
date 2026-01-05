const { supabaseAdmin } = require('../config/supabase');

const ALLOWED_TYPES = new Set(['Abono', 'Paz y salvo']);

// ------------------------------------------------------------------
// LISTAR RECAUDOS VETS (GET /api/recaudo_vets)
// ------------------------------------------------------------------
exports.getRecaudosVets = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('recaudo_vets')
            .select('*')
            .order('fecha_recaudo', { ascending: false });

        if (error) {
            return res.status(500).json({ message: 'Error al obtener recaudos.', error: error.message });
        }

        return res.status(200).json(data || []);
    } catch (error) {
        console.error('Error interno al listar recaudos vets:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// CREAR RECAUDO VETS (POST /api/recaudo_vets)
// ------------------------------------------------------------------
exports.createRecaudoVets = async (req, res) => {
    const {
        venta_confirmada_id,
        venta_tutor_id,
        tipo_recaudo,
        monto,
        pago_inicial,
        saldo_pendiente,
        fecha_recaudo
    } = req.body;

    if (!venta_confirmada_id || !venta_tutor_id || !tipo_recaudo) {
        return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

    if (!ALLOWED_TYPES.has(tipo_recaudo)) {
        return res.status(400).json({ message: 'Tipo de recaudo no valido.' });
    }

    const montoNumber = Number(monto);
    if (!Number.isFinite(montoNumber) || montoNumber < 0) {
        return res.status(400).json({ message: 'Monto invalido.' });
    }

    const pagoInicialNumber = pago_inicial !== null && pago_inicial !== '' && pago_inicial !== undefined
        ? Number(pago_inicial)
        : null;

    if (pagoInicialNumber !== null && (!Number.isFinite(pagoInicialNumber) || pagoInicialNumber < 0)) {
        return res.status(400).json({ message: 'Pago inicial invalido.' });
    }

    const saldoNumber = saldo_pendiente !== null && saldo_pendiente !== '' && saldo_pendiente !== undefined
        ? Number(saldo_pendiente)
        : null;

    if (saldoNumber !== null && !Number.isFinite(saldoNumber)) {
        return res.status(400).json({ message: 'Saldo pendiente invalido.' });
    }

    try {
        const payload = {
            venta_confirmada_id,
            venta_tutor_id,
            tipo_recaudo,
            monto: montoNumber,
            pago_inicial: pagoInicialNumber,
            saldo_pendiente: saldoNumber,
            fecha_recaudo: fecha_recaudo || new Date().toISOString()
        };

        const { data, error } = await supabaseAdmin
            .from('recaudo_vets')
            .insert([payload])
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: 'Error al guardar el recaudo.', error: error.message });
        }

        const { data: ventaData, error: ventaError } = await supabaseAdmin
            .from('ventas_kv_confirmadas')
            .select('monto_pagado, saldo_pendiente')
            .eq('id', venta_confirmada_id)
            .single();

        if (ventaError) {
            return res.status(500).json({ message: 'Recaudo guardado, pero no se pudo leer la venta confirmada.', error: ventaError.message });
        }

        const montoPagadoActual = Number(ventaData?.monto_pagado) || 0;
        const saldoActual = Number(ventaData?.saldo_pendiente);
        const saldoCalculado = Number.isFinite(saldoNumber)
            ? saldoNumber
            : (Number.isFinite(saldoActual) ? saldoActual - montoNumber : null);

        const { error: updateError } = await supabaseAdmin
            .from('ventas_kv_confirmadas')
            .update({
                monto_pagado: montoPagadoActual + montoNumber,
                saldo_pendiente: saldoCalculado
            })
            .eq('id', venta_confirmada_id);

        if (updateError) {
            return res.status(500).json({ message: 'Recaudo guardado, pero no se pudo actualizar la venta confirmada.', error: updateError.message });
        }

        return res.status(201).json({ message: 'Recaudo guardado.', data });
    } catch (error) {
        console.error('Error interno al crear recaudo vets:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};
