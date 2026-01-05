const express = require('express');
const router = express.Router();

const creditosKvController = require('../controllers/creditosKvController');
const { verifyAdminOrCallCenterActive } = require('../middlewares/middlewares');

router.use(verifyAdminOrCallCenterActive);

router.get('/', creditosKvController.getCreditosKv);
router.put('/:preventaId', creditosKvController.upsertCreditoKv);

module.exports = router;
