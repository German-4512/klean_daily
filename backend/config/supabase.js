const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // 🔥 NECESARIO

// Variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 🛑 Validaciones obligatorias
if (!supabaseUrl) {
  throw new Error('❌ SUPABASE_URL no está definida en el archivo .env');
}

if (!supabaseAnonKey) {
  throw new Error('❌ SUPABASE_ANON_KEY no está definida en el archivo .env');
}

if (!supabaseServiceRoleKey) {
  throw new Error('❌ SUPABASE_SERVICE_ROLE_KEY no está definida en el archivo .env');
}

// ✅ Cliente estándar (login, operaciones públicas)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 🔐 Cliente administrador (bypass RLS)
const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Exportamos ambos clientes
module.exports = {
  supabase,
  supabaseAdmin
};
