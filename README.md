# Interacción

Plataforma para crear experiencias compartibles: **¿Qué tanto me conoces?**, **Secretos y confesiones** y **Comparativas**.

## Stack
- React + Vite
- Supabase Auth, Postgres y Storage
- Experiencias públicas de lectura sin iniciar sesión; administración protegida por RLS.

## Desarrollo
1. Copia `.env.example` a `.env.local`.
2. Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Ejecuta `npm install` y `npm run dev`.

Nunca coloques claves `service_role` o secretas en el frontend.
