const { supabaseAdmin } = require('../config/supabase');

// ------------------------------------------------------------------
// CREAR PREVENTA CALL (POST /api/preventascall)
// ------------------------------------------------------------------
exports.createPreventaCall = async (req, res) => {
    const {
        num_doc,
        tipo_doc,
        nombre_paciente,
        nombre_tutor,
        tel_contacto,
        produc_1,
        cant_1,
        produc_2,
        cant_2,
        produc_3,
        cant_3,
        produc_4,
        cant_4,
        id_ads,
        origen_leads,
        fechaatencion
    } = req.body;

    if (!num_doc || !tipo_doc || !nombre_paciente || !nombre_tutor || !tel_contacto || !fechaatencion) {
        return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

    try {
        const normalizeText = (value) => {
            const text = String(value || '').trim();
            return text.length ? text : null;
        };

        const normalizeQuantity = (value) => {
            if (value === undefined || value === null || value === '') return null;
            const num = Number(value);
            if (!Number.isFinite(num)) return null;
            return num;
        };

        const payload = {
            num_doc,
            tipo_doc,
            nombre_paciente,
            nombre_tutor,
            tel_contacto,
            produc_1: normalizeText(produc_1),
            cant_1: normalizeQuantity(cant_1),
            produc_2: normalizeText(produc_2),
            cant_2: normalizeQuantity(cant_2),
            produc_3: normalizeText(produc_3),
            cant_3: normalizeQuantity(cant_3),
            produc_4: normalizeText(produc_4),
            cant_4: normalizeQuantity(cant_4),
            id_ads: id_ads || null,
            origen_leads: origen_leads || null,
            fechaatencion,
            fechapreventa: new Date().toISOString(),
            agente_id: req.user?.id || null
        };

        const { data, error } = await supabaseAdmin
            .from('preventascall')
            .insert([payload])
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: 'Error al guardar la pre venta.', error: error.message });
        }

        return res.status(201).json({ message: 'Pre venta guardada exitosamente.', data });
    } catch (error) {
        console.error('Error interno al guardar pre venta:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// LISTAR PREVENTAS CALL DEL ASESOR (GET /api/preventascall)
// ------------------------------------------------------------------
exports.getPreventasCall = async (req, res) => {
    try {
        const role = (req.userRole || '').trim().toLowerCase();
        const isAdmin = role === 'admin';
        const isDataVentas = role === 'datos y ventas klean vet';
        const all = String(req.query.all || '').toLowerCase() === 'true';

        let query = supabaseAdmin
            .from('preventascall')
            .select('*')
            .order('fechapreventa', { ascending: false });

        if (!isAdmin && !isDataVentas && !all) {
            query = query.eq('agente_id', req.user.id);
        }

        const preset = String(req.query.preset || '').toLowerCase();
        const date = String(req.query.date || '');

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
                query = query.gte('fechapreventa', start.toISOString());
                query = query.lt('fechapreventa', end.toISOString());
            }
        }

        const { data, error } = await query;
        if (error) {
            return res.status(500).json({ message: 'Error al obtener preventas.', error: error.message });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Error interno al listar preventas:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// ACTUALIZAR PREVENTA CALL (PUT /api/preventascall/:id)
// ------------------------------------------------------------------
exports.updatePreventaCall = async (req, res) => {
    const { id } = req.params;
    const {
        produc_1,
        cant_1,
        produc_2,
        cant_2,
        produc_3,
        cant_3,
        produc_4,
        cant_4,
        metodo_pago,
        estado_preventa,
        saldo_pendiente,
        notas
    } = req.body;

    try {
        const normalizeNumber = (value) => {
            if (value === undefined || value === null || value === '') return null;
            const num = Number(value);
            return Number.isFinite(num) ? num : null;
        };

        const normalizeText = (value) => {
            const text = String(value || '').trim();
            return text.length ? text : null;
        };

        const updates = {
            produc_1: produc_1 || null,
            cant_1: cant_1 || null,
            produc_2: produc_2 || null,
            cant_2: cant_2 || null,
            produc_3: produc_3 || null,
            cant_3: cant_3 || null,
            produc_4: produc_4 || null,
            cant_4: cant_4 || null,
            metodo_pago: metodo_pago || null,
            estado_preventa: estado_preventa || null,
            saldo_pendiente: normalizeNumber(saldo_pendiente),
            notas: normalizeText(notas)
        };

        const { data, error } = await supabaseAdmin
            .from('preventascall')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: 'Error al guardar la preventa.', error: error.message });
        }

        return res.status(200).json({ message: 'Preventa actualizada.', data });
    } catch (error) {
        console.error('Error interno al actualizar preventa:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// ELIMINAR PREVENTA CALL (DELETE /api/preventascall/:id)
// ------------------------------------------------------------------
exports.deletePreventaCall = async (req, res) => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'Id requerido.' });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('preventascall')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: 'Error al eliminar la preventa.', error: error.message });
        }

        return res.status(200).json({ message: 'Preventa eliminada.', data });
    } catch (error) {
        console.error('Error interno al eliminar preventa:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// METRICAS PREVENTAS CALL (GET /api/preventascall/metrics)
// ------------------------------------------------------------------
exports.getPreventasMetrics = async (req, res) => {
    try {
        const role = (req.userRole || '').trim().toLowerCase();
        const isAdmin = role === 'admin';
        const all = String(req.query.all || '').toLowerCase() === 'true';

        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        let query = supabaseAdmin
            .from('preventascall')
            .select('fechapreventa, num_doc, id_ads, origen_leads, agente_id')
            .ilike('estado_preventa', 'confirmada')
            .gte('fechapreventa', yearStart.toISOString())
            .lt('fechapreventa', yearEnd.toISOString());

        if (!isAdmin && !all) {
            query = query.eq('agente_id', req.user.id);
        }

        let clientsQuery = supabaseAdmin
            .from('preventascall')
            .select('num_doc')
            .ilike('estado_preventa', 'confirmada');

        let confirmedQuery = supabaseAdmin
            .from('preventascall')
            .select('id, fechapreventa, num_doc, produc_1, cant_1, produc_2, cant_2, produc_3, cant_3, produc_4, cant_4, estado_preventa, metodo_pago, agente_id')
            .ilike('estado_preventa', 'confirmada');

        let recaudosQuery = supabaseAdmin
            .from('recaudo_call')
            .select('preventa_id, tipo_recaudo, fecha_recaudo, agente_id');

        if (!isAdmin && !all) {
            clientsQuery = clientsQuery.eq('agente_id', req.user.id);
            confirmedQuery = confirmedQuery.eq('agente_id', req.user.id);
            recaudosQuery = recaudosQuery.eq('agente_id', req.user.id);
        }

        const [
            { data, error },
            { data: clientsData, error: clientsError },
            { data: confirmedData, error: confirmedError },
            { data: recaudosData, error: recaudosError }
        ] = await Promise.all([
            query,
            clientsQuery,
            confirmedQuery,
            recaudosQuery
        ]);
        if (error) {
            return res.status(500).json({ message: 'Error al obtener métricas.', error: error.message });
        }
        if (clientsError) {
            return res.status(500).json({ message: 'Error al obtener clientes.', error: clientsError.message });
        }
        if (confirmedError) {
            return res.status(500).json({ message: 'Error al obtener ventas confirmadas.', error: confirmedError.message });
        }
        if (recaudosError) {
            return res.status(500).json({ message: 'Error al obtener recaudos.', error: recaudosError.message });
        }

        const dayCounts = Array.from({ length: daysInMonth }, () => 0);
        const dayUnits = Array.from({ length: daysInMonth }, () => 0);
        const monthCounts = Array.from({ length: 12 }, () => 0);
        const monthUnits = Array.from({ length: 12 }, () => 0);
        const monthClientSets = Array.from({ length: 12 }, () => new Set());
        const monthRetenidas = Array.from({ length: 12 }, () => 0);
        const monthComisiones = Array.from({ length: 12 }, () => 0);
        const clientesSet = new Set();

        data.forEach((item) => {
            if (!item.fechapreventa) return;

            const date = new Date(item.fechapreventa);
            if (isNaN(date.getTime())) return;

            const monthIndex = date.getMonth();
            monthCounts[monthIndex] += 1;

            if (date >= monthStart && date < monthEnd) {
                const dayIndex = date.getDate() - 1;
                if (dayIndex >= 0 && dayIndex < dayCounts.length) {
                    dayCounts[dayIndex] += 1;
                }
            }
        });

        clientsData.forEach((item) => {
            const doc = String(item.num_doc || '').trim();
            if (doc) clientesSet.add(doc);
        });

        const productoUnidades = new Map();
        let totalUnidades = 0;
        let totalComisionesNetas = 0;
        let totalComisionesGenerales = 0;
        let totalComisionesRetenidas = 0;

        const normalizeStatus = (value) =>
            String(value || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z]/g, '');

        const isConfirmada = (value) => {
            const normalized = normalizeStatus(value);
            return normalized === 'confirmada' || normalized === 'confirmado';
        };

        const normalizeProduct = (value) =>
            String(value || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, ' ')
                .trim();

        const productRates = new Map([
            ['1% 15 ml', 5000],
            ['2% 15 ml', 5000],
            ['2% 30 ml', 10000],
            ['3% 100 ml', 10000],
            ['gastro plus', 5000],
            ['derma plus', 5000],
            ['adulto plus', 5000]
        ]);

        const isCredito = (value) => normalizeStatus(value) === 'credito';
        const pazYSalvoMap = new Map();
        (recaudosData || []).forEach((item) => {
            if (normalizeStatus(item.tipo_recaudo) !== 'pazysalvo') return;
            if (!item.preventa_id) return;
            const fecha = new Date(item.fecha_recaudo);
            if (isNaN(fecha.getTime())) return;
            const prev = pazYSalvoMap.get(item.preventa_id);
            if (!prev || fecha > prev) {
                pazYSalvoMap.set(item.preventa_id, fecha);
            }
        });

        confirmedData.forEach((item) => {
            if (!isConfirmada(item.estado_preventa)) return;
            const credito = isCredito(item.metodo_pago);
            const fechaRecaudo = credito ? pazYSalvoMap.get(item.id) : null;
            const hasPazYSalvo = credito ? Boolean(fechaRecaudo) : true;

            let inMonthRange = false;
            let inYearRange = false;
            const fecha = item.fechapreventa ? new Date(item.fechapreventa) : null;
            let comisionPreventa = 0;
            let comisionMes = 0;
            if (fecha && !isNaN(fecha.getTime()) && fecha >= yearStart && fecha < yearEnd) {
                inYearRange = true;
                inMonthRange = fecha >= monthStart && fecha < monthEnd;
                const doc = String(item.num_doc || '').trim();
                if (doc) monthClientSets[fecha.getMonth()].add(doc);
                let unidadesMes = 0;
                let unidadesDia = 0;
                for (let i = 1; i <= 4; i += 1) {
                    const cantidad = Number(item[`cant_${i}`]) || 0;
                    if (cantidad > 0) {
                        unidadesMes += cantidad;
                        unidadesDia += cantidad;
                    }
                }
                monthUnits[fecha.getMonth()] += unidadesMes;
                if (inMonthRange) {
                    const dayIndex = fecha.getDate() - 1;
                    if (dayIndex >= 0 && dayIndex < dayUnits.length) {
                        dayUnits[dayIndex] += unidadesDia;
                    }
                }
            }

            for (let i = 1; i <= 4; i += 1) {
                const producto = item[`produc_${i}`];
                const cantidad = Number(item[`cant_${i}`]) || 0;
                if (!producto && cantidad > 0) {
                    totalUnidades += cantidad;
                    continue;
                }
                if (!producto || cantidad <= 0) continue;

                const key = String(producto).trim();
                productoUnidades.set(key, (productoUnidades.get(key) || 0) + cantidad);
                totalUnidades += cantidad;

                const rate = productRates.get(normalizeProduct(producto)) || 0;
                if (credito) {
                    if (hasPazYSalvo) {
                        totalComisionesGenerales += rate * cantidad;
                        comisionPreventa += rate * cantidad;
                        if (fechaRecaudo.getFullYear() === now.getFullYear()) {
                            monthComisiones[fechaRecaudo.getMonth()] += rate * cantidad;
                        }
                        const inRecaudoMonth = fechaRecaudo >= monthStart && fechaRecaudo < monthEnd;
                        const sameMonthRecaudo = inMonthRange && fecha
                            && fechaRecaudo.getFullYear() === fecha.getFullYear()
                            && fechaRecaudo.getMonth() === fecha.getMonth();
                        if (inRecaudoMonth || sameMonthRecaudo) {
                            totalComisionesNetas += rate * cantidad;
                            comisionMes += rate * cantidad;
                        }
                    } else {
                        if (inMonthRange) {
                            totalComisionesRetenidas += rate * cantidad;
                        }
                        if (inYearRange && fecha) {
                            monthRetenidas[fecha.getMonth()] += rate * cantidad;
                        }
                    }
                } else if (inMonthRange) {
                    totalComisionesGenerales += rate * cantidad;
                    totalComisionesNetas += rate * cantidad;
                    comisionPreventa += rate * cantidad;
                    comisionMes += rate * cantidad;
                    if (inYearRange && fecha) {
                        monthComisiones[fecha.getMonth()] += rate * cantidad;
                    }
                } else {
                    totalComisionesGenerales += rate * cantidad;
                    comisionPreventa += rate * cantidad;
                    if (inYearRange && fecha) {
                        monthComisiones[fecha.getMonth()] += rate * cantidad;
                    }
                }
            }

        });

        const unidadesPorProducto = Array.from(productoUnidades.entries())
            .map(([producto, unidades]) => ({ producto, unidades }))
            .sort((a, b) => b.unidades - a.unidades);

        const response = {
            totalPreventasMes: dayCounts.reduce((sum, val) => sum + val, 0),
            totalClientes: clientesSet.size,
            totalComisionesNetas,
            totalComisionesGenerales,
            totalComisionesRetenidas,
            totalUnidades,
            unidadesPorProducto,
            byDay: dayCounts,
            byMonth: monthCounts,
            unidadesByMonth: monthUnits,
            unidadesByDay: dayUnits,
            clientesByMonth: monthClientSets.map((set) => set.size),
            retenidasByMonth: monthRetenidas,
            comisionesByMonth: monthComisiones
        };

        return res.status(200).json(response);
    } catch (error) {
        console.error('Error interno al obtener métricas:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// ------------------------------------------------------------------
// LISTAR ASESORES CALLCENTER (GET /api/preventascall/advisors)
// ------------------------------------------------------------------
exports.getCallCenterAdvisors = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('id, nombre_apellido, email, rol, estado')
            .order('nombre_apellido', { ascending: true });

        if (error) {
            return res.status(500).json({ message: 'Error al obtener asesores.', error: error.message });
        }

        const normalizeValue = (value) =>
            String(value || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z]/g, '');

        const advisors = (data || []).filter((profile) => {
            const role = normalizeValue(profile.rol);
            const estado = normalizeValue(profile.estado);
            const isCallCenter = role === 'asesorcomercialcallcenter' && estado === 'activo';
            const isAgenteMayor = role === 'agentemayor' && estado === 'activo';
            return isCallCenter || isAgenteMayor;
        });

        return res.status(200).json(advisors);
    } catch (error) {
        console.error('Error interno al listar asesores:', error);
        return res.status(500).json({ message: 'Error interno del servidor.' });
    }
};
