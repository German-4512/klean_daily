const CACHE_NAME = 'klean-daily-v44';
const CORE_ASSETS = [
  './',
  './inicio_sesion.html',
  './inicio_sesion.css',
  './inicio_sesion.js',
  './admin.html',
  './admin.css',
  './admin.js',
  './agentes_call.html',
  './agentes_call.css',
  './asistente_citas_call.html',
  './asistente_citas_call.css',
  './asistente_citas_call.js',
  './registrar_agendar_call.html',
  './registrar_agendar_call.css',
  './registrar_agendar_call.js',
  './perfil_cliente.html',
  './perfil_cliente.css',
  './perfil_cliente.js',
  './veterinario_tutores.html',
  './veterinario_tutores.css',
  './seguimiento_vets.html',
  './seguimiento_vets.css',
  './seguimiento_vets.js',
  './mis_ventas_veterinario.html',
  './mis_ventas_veterinario.js',
  './form_seguimiento_vets_30_dias.html',
  './form_seguimiento_vets_45_dias.html',
  './form_seguimiento_vets.css',
  './form_seguimiento_vets.js',
  './form_seguimiento_vets_45_dias.js',
  './mis_pre_ventas_call.html',
  './mis_pre_ventas_call.css',
  './mis_pre_ventas_call.js',
  './mis_comisiones_call.html',
  './mis_comisiones_call.css',
  './mis_comisiones_call.js',
  './creditos_call.html',
  './creditos_call.css',
  './creditos_call.js',
  './creditos_tutores.html',
  './creditos_tutores.css',
  './creditos_tutores.js',
  './mi_rendimiento_call.html',
  './mi_rendimiento_call.css',
  './mi_rendimiento_call.js',
  './datos_ventas_kv.html',
  './datos_ventas_kv.css',
  './cargar_ventas_kv.html',
  './cargar_ventas_kv.css',
  './cargar_ventas_kv.js',
  './ventas_kv.html',
  './ventas_kv.css',
  './ventas_kv.js',
  './confirmar_ventas_kv.html',
  './confirmar_ventas_kv.css',
  './confirmar_ventas_kv.js',
  './invitado_kv.html',
  './invitado_kv.css',
  './invitado_kv.js',
  './dashboard_seguimientos.html',
  './dashboard_seguimientos.css',
  './dashboard_seguimientos.js',
  './form_call.html',
  './form_call.css',
  './form_call.js',
  './rendimiento_dia.html',
  './rendimiento_dia.js',
  './rendimiento_daily.html',
  './rendimiento_daily.css',
  './rendimiento_daily.js',
  './rendimiento_asesor_kv.html',
  './rendimiento_asesor_kv.css',
  './rendimiento_asesor_kv.js',
  './Fondo_login.svg',
  './manifest.json',
  './icon.svg',
  './sw-register.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key))))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      }).catch(() => caches.match('./inicio_sesion.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
