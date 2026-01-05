// backend/routes/auth.js

const express = require('express');
const router = express.Router();

// Usamos la ruta relativa para importar el controlador de autenticación
const authController = require('../controllers/authController');

/**
 * Definición de Rutas de Autenticación
 * Prefijo: /api/auth
 */

// Ruta para el inicio de sesión del usuario
// POST /api/auth/login
router.post('/login', authController.loginUser);

// Ruta para obtener el perfil del usuario autenticado
// GET /api/auth/me
router.get('/me', authController.getMe);

// Si en el futuro necesita registrar usuarios (signup), iría aquí:
// router.post('/register', authController.registerUser); 

module.exports = router;
