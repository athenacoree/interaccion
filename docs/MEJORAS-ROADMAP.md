# Interacción — estado de mejoras

## Objetivo
Una plataforma social móvil para crear juegos y experiencias, compartir enlaces y administrar respuestas desde un panel privado.

## Implementado en esta versión

### Creación de experiencias
- Asistente guiado: elegir formato, seleccionar una plantilla o empezar desde cero y personalizar.
- Tres formatos: «¿Qué tanto me conoces?», «Secretos y confesiones» y «Cara a cara».
- Plantillas con títulos y preguntas iniciales; el título y los textos se pueden editar.
- Preguntas múltiples para los cuestionarios, opciones personalizadas y carga de imágenes para comparativas.
- Borradores y publicación; los juegos publicados se pueden pausar, archivar y restaurar.
- Edición de preguntas y opciones, duplicación y eliminación de experiencias.
- Copia del enlace del perfil y de cada experiencia.

### Resultados y bandeja de mensajes
- Bandeja privada por experiencia, con búsqueda.
- Eliminar respuestas individuales, seleccionadas o vaciar la bandeja.
- Marcar como leído/no leído y guardar favoritos.
- Ajustes de anonimato por experiencia.
- Las confesiones se muestran únicamente en el panel privado del propietario.

### Estadísticas y privacidad
- Visitas al perfil y aperturas de experiencias.
- Registro de respuestas enviadas y actividad reciente con fecha y hora.
- Resumen de los últimos 30 días y visitantes únicos estimados por navegador.
- No se recopilan direcciones IP ni se intenta identificar personalmente a los visitantes.
- El perfil puede configurarse como público o privado.

### Seguridad de cuestionarios
- Las respuestas correctas se guardan en una tabla privada, no en los datos que recibe el visitante.
- El envío se valida en el servidor de base de datos.
- La inserción directa de respuestas está bloqueada; los visitantes usan una función de envío validada.
- Las políticas de acceso limitan la lectura, actualización y eliminación de respuestas al propietario.

## Pendiente para futuras iteraciones

- Gráficas por día/semana/mes y filtros de periodo en estadísticas.
- Métricas de finalización y participación por pregunta.
- Archivar mensajes y cerrar temporalmente la recepción.
- Notificaciones en tiempo real de nuevas respuestas.
- Portadas, más opciones de personalización visual y juegos destacados.
- Búsqueda global y organización de experiencias por etiquetas.
- Pruebas completas en navegador móvil: registro, inicio de sesión, creación, envío, edición, duplicación y eliminación.

## Criterios de aceptación
Una función solo se considera terminada cuando guarda y recupera datos correctamente, respeta las políticas de Supabase y se ha probado en móvil. Las visitas únicas son estimaciones por navegador y día, no personas identificadas.

## Nota de contenido responsable
Las plantillas de comparativas se orientan a preferencias sobre diseños, ideas u objetos. Evitar usar la plataforma para calificar cuerpos o rostros de personas, exponer datos privados o acosar a alguien.
