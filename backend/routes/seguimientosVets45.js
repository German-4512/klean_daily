const express = require('express');
const router = express.Router();

const seguimientos45Controller = require('../controllers/seguimientosVets45Controller');
const { verifyAdminOrVeterinario } = require('../middlewares/middlewares');

router.use(verifyAdminOrVeterinario);

router.get('/', seguimientos45Controller.getSeguimientos45);
router.post('/', seguimientos45Controller.createSeguimiento45);
router.post('/progreso', seguimientos45Controller.saveSeguimientoProgress45);

module.exports = router;
