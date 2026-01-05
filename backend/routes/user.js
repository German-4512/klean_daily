const express = require('express');
const router = express.Router();

// Controlador
const userController = require('../controllers/userController');

// Middleware (RUTA RELATIVA CORRECTA)
const { verifyAdmin } = require('../middlewares/middlewares');

// Todas estas rutas requieren token JWT y rol Admin
router.use(verifyAdmin);

// 1. CREAR Usuario (POST /api/users)
router.post('/', userController.createUser);

// 2. LEER todos los usuarios (GET /api/users)
router.get('/', userController.getAllUsers);

// 3. LEER usuario por ID (GET /api/users/:id)
router.get('/:id', userController.getUserById);

// 4. MODIFICAR usuario (PUT /api/users/:id)
router.put('/:id', userController.updateUser);

// 5. ELIMINAR usuario (DELETE /api/users/:id)
router.delete('/:id', userController.deleteUser);

module.exports = router;
