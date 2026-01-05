const express = require('express');
const router = express.Router();

const creditosVetsController = require('../controllers/creditosVetsController');
const { verifyAdminOrCallCenterActive } = require('../middlewares/middlewares');

router.use(verifyAdminOrCallCenterActive);

router.get('/', creditosVetsController.getCreditosVets);
router.put('/:ventaConfirmadaId', creditosVetsController.upsertCreditoVets);

module.exports = router;
