const express = require('express');
const router = express.Router();

const preventasCallController = require('../controllers/preventasCallController');
const { verifyAdminOrCallCenterActive } = require('../middlewares/middlewares');

// Todas estas rutas requieren token y rol permitido
router.use(verifyAdminOrCallCenterActive);

// 1. METRICAS Preventas call (GET /api/preventascall/metrics)
router.get('/metrics', preventasCallController.getPreventasMetrics);

// 1.1 LISTAR ASESORES (GET /api/preventascall/advisors)
router.get('/advisors', preventasCallController.getCallCenterAdvisors);

// 2. LISTAR Preventas call (GET /api/preventascall)
router.get('/', preventasCallController.getPreventasCall);

// 3. CREAR Pre venta call (POST /api/preventascall)
router.post('/', preventasCallController.createPreventaCall);

// 4. ACTUALIZAR Pre venta call (PUT /api/preventascall/:id)
router.put('/:id', preventasCallController.updatePreventaCall);
// 5. ELIMINAR Pre venta call (DELETE /api/preventascall/:id)
router.delete('/:id', preventasCallController.deletePreventaCall);

module.exports = router;
