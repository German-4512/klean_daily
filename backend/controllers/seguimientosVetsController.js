const { supabaseAdmin } = require('../config/supabase');

exports.getSeguimientos = async (req, res) => {
    try {
        const ventaId = String(req.query.venta_confirmada_id || '').trim();
        const ventaIds = String(req.query.venta_confirmada_ids || '').trim();

        let query = supabaseAdmin
            .from('seguimientos_vets_realizados_30_dias')
            .select('id, venta_confirmada_id, seguimiento_dias, contactar_cliente, estado_paciente, satisfaccion_cliente, efectos_secundarios, resultados_observaciones, estado, recordatorio_sg, hasta_aqui, created_at')
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
            return res.status(500).json({ message: 'Error al obtener seguimientos.', error: error.message });
        }

        return res.status(200).json(data || []);
    } catch (error) {
        console.error('Error interno al listar seguimientos:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

exports.createSeguimiento = async (req, res) => {
    const {
        venta_confirmada_id,
        seguimiento_dias,
        contactar_cliente,
        estado_paciente,
        satisfaccion_cliente,
        efectos_secundarios,
        resultados_observaciones,
        estado,
        recordatorio_sg,
        hasta_aqui
    } = req.body;

    if (!venta_confirmada_id || !seguimiento_dias) {
        return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

    try {
        const payload = {
            venta_confirmada_id,
            seguimiento_dias,
            contactar_cliente: contactar_cliente || null,
            estado_paciente: estado_paciente || null,
            satisfaccion_cliente: satisfaccion_cliente || null,
            efectos_secundarios: efectos_secundarios || null,
            resultados_observaciones: resultados_observaciones || null,
            estado: estado || 'Finalizado',
            recordatorio_sg: recordatorio_sg ?? null,
            hasta_aqui: hasta_aqui ?? null
        };

        const { data: existing, error: findError } = await supabaseAdmin
            .from('seguimientos_vets_realizados_30_dias')
            .select('id')
            .eq('venta_confirmada_id', venta_confirmada_id)
            .eq('seguimiento_dias', seguimiento_dias)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (findError) {
            return res.status(500).json({ message: 'Error al validar seguimiento.', error: findError.message });
        }

        const query = existing?.id
            ? supabaseAdmin.from('seguimientos_vets_realizados_30_dias').update(payload).eq('id', existing.id).select().single()
            : supabaseAdmin.from('seguimientos_vets_realizados_30_dias').insert([payload]).select().single();

        const { data, error } = await query;

        if (error) {
            return res.status(500).json({ message: 'Error al guardar seguimiento.', error: error.message });
        }

        return res.status(201).json({ message: 'Seguimiento guardado.', data });
    } catch (error) {
        console.error('Error interno al guardar seguimiento:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

exports.saveSeguimientoProgress = async (req, res) => {
    const {
        venta_confirmada_id,
        seguimiento_dias,
        recordatorio_sg,
        hasta_aqui,
        estado,
        contactar_cliente,
        estado_paciente,
        satisfaccion_cliente,
        efectos_secundarios,
        resultados_observaciones
    } = req.body;

    if (!venta_confirmada_id || !seguimiento_dias) {
        return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

    try {
        const payload = {
            venta_confirmada_id,
            seguimiento_dias,
            hasta_aqui: hasta_aqui ?? null,
            estado: estado || 'En progreso'
        };

        if (recordatorio_sg !== undefined) {
            payload.recordatorio_sg = recordatorio_sg;
        }
        if (contactar_cliente !== undefined) {
            payload.contactar_cliente = contactar_cliente;
        }
        if (estado_paciente !== undefined) {
            payload.estado_paciente = estado_paciente;
        }
        if (satisfaccion_cliente !== undefined) {
            payload.satisfaccion_cliente = satisfaccion_cliente;
        }
        if (efectos_secundarios !== undefined) {
            payload.efectos_secundarios = efectos_secundarios;
        }
        if (resultados_observaciones !== undefined) {
            payload.resultados_observaciones = resultados_observaciones;
        }

        const { data: existing, error: findError } = await supabaseAdmin
            .from('seguimientos_vets_realizados_30_dias')
            .select('id, estado')
            .eq('venta_confirmada_id', venta_confirmada_id)
            .eq('seguimiento_dias', seguimiento_dias)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (findError) {
            return res.status(500).json({ message: 'Error al validar seguimiento.', error: findError.message });
        }

        if (existing?.estado === 'Finalizado') {
            return res.status(200).json({ message: 'Seguimiento ya finalizado.' });
        }

        const query = existing?.id
            ? supabaseAdmin.from('seguimientos_vets_realizados_30_dias').update(payload).eq('id', existing.id).select().single()
            : supabaseAdmin.from('seguimientos_vets_realizados_30_dias').insert([payload]).select().single();

        const { data, error } = await query;

        if (error) {
            return res.status(500).json({ message: 'Error al guardar progreso.', error: error.message });
        }

        return res.status(201).json({ message: 'Progreso guardado.', data });
    } catch (error) {
        console.error('Error interno al guardar progreso:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};
