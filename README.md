# Interacción

Plataforma estática para crear y compartir experiencias:
- **¿Qué tanto me conoces?** — retos con varias preguntas y opciones.
- **Secretos y confesiones** — mensajes privados visibles solo para la persona creadora.
- **Cara a cara** — comparativas con dos imágenes y votación.

## Arquitectura
- React + Vite, desplegado como sitio estático en **GitHub Pages**.
- Supabase Auth para cuentas, Postgres para perfiles/experiencias/respuestas y Storage para imágenes.
- Los visitantes pueden abrir enlaces y responder sin registrarse.
- Las rutas se comparten como hash URLs (`/#/u/usuario` y `/#/e/experiencia`) para que funcionen en GitHub Pages sin servidor de reescritura.

La URL de Supabase y su **publishable key** están configuradas en el cliente. Esa clave está diseñada para estar en el navegador; nunca se debe añadir una clave `service_role` ni una clave secreta al frontend.

## Despliegue
1. En GitHub, abre **Settings → Pages** y selecciona **GitHub Actions** como fuente de despliegue.
2. El workflow `.github/workflows/deploy.yml` compila y publica automáticamente cada cambio en `main`.
3. La dirección esperada del sitio es `https://athenacoree.github.io/interaccion/`.
4. En Supabase, abre **Authentication → URL Configuration** y añade como Site URL:
   `https://athenacoree.github.io/interaccion/`
   Añade también como Redirect URL:
   `https://athenacoree.github.io/interaccion/**`
5. Espera a que el workflow de GitHub Pages termine y abre la URL publicada.

## Desarrollo local
```bash
npm install
npm run dev
```

## Vista previa al compartir
La portada incluye Open Graph y Twitter Card con una reproducción de dominio público de *La noche estrellada*, de Vincent van Gogh (1889), alojada en Wikimedia Commons. Es únicamente la imagen de vista previa; el diseño normal de Interacción usa fondos claros.
