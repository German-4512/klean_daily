const express = require('express');
const router = express.Router();

const seguimientosController = require('../controllers/seguimientosVetsController');
const { verifyAdminOrVeterinario } = require('../middlewares/middlewares');

router.use(verifyAdminOrVeterinario);

router.get('/', seguimientosController.getSeguimientos);
router.post('/', seguimientosController.createSeguimiento);
router.post('/progreso', seguimientosController.saveSeguimientoProgress);

module.exports = router;
