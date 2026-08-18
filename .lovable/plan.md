# Mi Carnet (miDGT UI) — portar la app subida

Tu ZIP es una app Next.js de una sola pantalla ("miDGT UI", proyecto de portfolio) con toda la interfaz en `app/page.tsx` (816 líneas) y su CSS propio (1532 líneas). Este proyecto usa TanStack Start, así que hay que portarla, no copiarla tal cual.

## Qué se construirá

- La app completa en la página principal `/`: pantalla de acceso, carga, inicio con puntos, carnet de conducir, vehículo, detalle de vehículo y permiso de circulación.
- Mismo diseño, mismos textos y mismos datos por defecto (Carlos Medina, 8263 JTR, 13 puntos, fechas de permisos, ITV, seguro).
- Edición de perfil con foto (recorte/zoom) y guardado en el navegador, igual que ahora (localStorage).
- Todas las imágenes del ZIP (logo DGT, fondos, clases AM/A1/B, distintivo C, bandera, foto de perfil) publicadas como assets de la app.
- Metadatos de la página: título "miDGT UI — Proyecto de portfolio" y descripción de recreación no oficial.

## Cómo

- `src/routes/index.tsx`: componente con toda la lógica de `app/page.tsx`, sin `"use client"` ni APIs de Next; la lectura de localStorage se hace en `useEffect` para evitar problemas de hidratación en SSR.
- CSS: `app/globals.css` se integra en `src/styles.css` conservando las clases originales y las variables de Tailwind v4 existentes.
- Imágenes: se suben como assets CDN (`src/assets/*.asset.json`) y se importan; el favicon se copia a `public/`.
- Se descartan las partes específicas de Cloudflare/vinext del ZIP (worker, drizzle, D1, tests) porque no aplican aquí y la app no usa base de datos.
- Si el archivo resulta demasiado grande, se dividirá en componentes por pantalla en `src/components/carnet/`, sin cambiar el aspecto.

## Fuera de alcance

- Sin backend ni base de datos (los datos siguen siendo locales del dispositivo).