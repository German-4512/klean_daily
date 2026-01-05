const { supabaseAdmin } = require('../config/supabase');

const SEGUIMIENTO_LABEL = 'Seg 45 Dias';

exports.getSeguimientos45 = async (req, res) => {
    try {
        const ventaId = String(req.query.venta_confirmada_id || '').trim();
        const ventaIds = String(req.query.venta_confirmada_ids || '').trim();

        let query = supabaseAdmin
            .from('seguimientos_vets_realizados_45_dias')
            .select('id, venta_confirmada_id, contacto_estado, contacto_detalle, csat_puntaje, csat_justificacion, engagement, uso_producto, probabilidad_recompra, valor_agregado, observaciones, proximo_contacto, estado, recordatorio_sg, hasta_aqui, created_at, updated_at')
            .order('created_at', { ascending: false });

        if (ventaId) {
            query = query.eq('venta_confirmada_id', ventaId);
        } else if (ventaIds) {
            const ids = ventaIds.split(',').map((value) => value.trim()).filter(Boolean);
            if (ids.length) {
                query = query.in('venta_confirmada_id', ids);
            }
        }

        const { data, error } = await query;
        if (error) {
            return res.status(500).json({ message: 'Error al obtener seguimientos 45 dias.', error: error.message });
        }

        const formatted = (data || []).map((item) => ({
            ...item,
            seguimiento_dias: SEGUIMIENTO_LABEL,
            estado: item.estado || 'Finalizado',
            recordatorio_sg: item.recordatorio_sg ?? null
        }));

        return res.status(200).json(formatted);
    } catch (error) {
        console.error('Error interno al listar seguimientos 45 dias:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

exports.createSeguimiento45 = async (req, res) => {
    const {
        venta_confirmada_id,
        contacto_estado,
        contacto_detalle,
        csat_puntaje,
        csat_justificacion,
        engagement,
        uso_producto,
        probabilidad_recompra,
        valor_agregado,
        observaciones,
        proximo_contacto
    } = req.body;

    if (!venta_confirmada_id) {
        return res.status(400).json({ message: 'Falta el id de la venta confirmada.' });
    }

    try {
        const payload = {
            venta_confirmada_id,
            contacto_estado: contacto_estado || null,
            contacto_detalle: contacto_detalle || null,
            csat_puntaje: csat_puntaje || null,
            csat_justificacion: csat_justificacion || null,
            engagement: engagement || null,
            uso_producto: uso_producto || null,
            probabilidad_recompra: probabilidad_recompra || null,
            valor_agregado: valor_agregado || null,
            observaciones: observaciones || null,
            proximo_contacto: proximo_contacto || null,
            estado: 'Finalizado',
            recordatorio_sg: null,
            hasta_aqui: null
        };

        const { data: existing, error: findError } = await supabaseAdmin
            .from('seguimientos_vets_realizados_45_dias')
            .select('id')
            .eq('venta_confirmada_id', venta_confirmada_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (findError) {
            return res.status(500).json({ message: 'Error al validar seguimiento 45 dias.', error: findError.message });
        }

        const query = existing?.id
            ? supabaseAdmin.from('seguimientos_vets_realizados_45_dias').update(payload).eq('id', existing.id).select().single()
            : supabaseAdmin.from('seguimientos_vets_realizados_45_dias').insert([payload]).select().single();

        const { data, error } = await query;
        if (error) {
            return res.status(500).json({ message: 'Error al guardar seguimiento 45 dias.', error: error.message });
        }

        return res.status(201).json({ message: 'Seguimiento 45 dias guardado.', data });
    } catch (error) {
        console.error('Error interno al guardar seguimiento 45 dias:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

exports.saveSeguimientoProgress45 = async (req, res) => {
    const {
        venta_confirmada_id,
        recordatorio_sg,
        hasta_aqui,
        estado,
        contacto_estado,
        contacto_detalle,
        csat_puntaje,
        csat_justificacion,
        engagement,
        uso_producto,
        probabilidad_recompra,
        valor_agregado,
        observaciones,
        proximo_contacto
    } = req.body;

    if (!venta_confirmada_id) {
        return res.status(400).json({ message: 'Falta el id de la venta confirmada.' });
    }

    try {
        const payload = {
            venta_confirmada_id,
            estado: estado || 'En progreso'
        };

        if (recordatorio_sg !== undefined) payload.recordatorio_sg = recordatorio_sg;
        if (hasta_aqui !== undefined) payload.hasta_aqui = hasta_aqui;
        if (contacto_estado !== undefined) payload.contacto_estado = contacto_estado;
        if (contacto_detalle !== undefined) payload.contacto_detalle = contacto_detalle;
        if (csat_puntaje !== undefined) payload.csat_puntaje = csat_puntaje;
        if (csat_justificacion !== undefined) payload.csat_justificacion = csat_justificacion;
        if (engagement !== undefined) payload.engagement = engagement;
        if (uso_producto !== undefined) payload.uso_producto = uso_producto;
        if (probabilidad_recompra !== undefined) payload.probabilidad_recompra = probabilidad_recompra;
        if (valor_agregado !== undefined) payload.valor_agregado = valor_agregado;
        if (observaciones !== undefined) payload.observaciones = observaciones;
        if (proximo_contacto !== undefined) payload.proximo_contacto = proximo_contacto;

        const { data: existing, error: findError } = await supabaseAdmin
            .from('seguimientos_vets_realizados_45_dias')
            .select('id, estado')
            .eq('venta_confirmada_id', venta_confirmada_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (findError) {
            return res.status(500).json({ message: 'Error al validar seguimiento 45 dias.', error: findError.message });
        }

        if (existing?.estado === 'Finalizado') {
            return res.status(200).json({ message: 'Seguimiento ya finalizado.' });
        }

        const query = existing?.id
            ? supabaseAdmin.from('seguimientos_vets_realizados_45_dias').update(payload).eq('id', existing.id).select().single()
            : supabaseAdmin.from('seguimientos_vets_realizados_45_dias').insert([payload]).select().single();

        const { data, error } = await query;
        if (error) {
            return res.status(500).json({ message: 'Error al guardar progreso 45 dias.', error: error.message });
        }

        return res.status(201).json({ message: 'Progreso 45 dias guardado.', data });
    } catch (error) {
        console.error('Error interno al guardar progreso 45 dias:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};
