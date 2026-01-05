const express = require('express');
const router = express.Router();

const citasKleanVetController = require('../controllers/citasKleanVetController');
const { verifyAdminOrCallCenterActive } = require('../middlewares/middlewares');

// Todas estas rutas requieren token y rol permitido
router.use(verifyAdminOrCallCenterActive);

// 1. LISTAR CITAS (GET /api/citas_klean_vet)
router.get('/', citasKleanVetController.getCitas);

// 2. CREAR CITA (POST /api/citas_klean_vet)
router.post('/', citasKleanVetController.createCita);

// 3. ACTUALIZAR CITA (PUT /api/citas_klean_vet/:id)
router.put('/:id', citasKleanVetController.updateCita);

// 4. ELIMINAR CITA (DELETE /api/citas_klean_vet/:id)
router.delete('/:id', citasKleanVetController.deleteCita);

module.exports = router;
