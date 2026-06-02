# Cursos Vacacionales · Musicala

Aplicativo web para coordinar los cursos vacacionales de Musicala: contactos e interesados,
inscripciones, horarios y docentes, asistencia, Musicafé (onces), ruta, materiales,
información por temporada y estadísticas. Construido con **Firebase** (Auth + Firestore + Hosting).

## Características

- 🔐 Login con Google restringido a correos autorizados.
- 📅 Temporadas independientes con fechas, precios, descuentos y valor de ruta (histórico).
- 📇 Contactos / pipeline con seguimiento y anti-duplicados (nombre, correo, teléfono).
- 🔗 Conexión con la **base general** (proyecto `db-musicala`): trae automáticamente a quienes
  tengan la etiqueta *Vacacionales* en Listado, Arte I o Curso/Plan.
- ✅ Inscripciones con paquete, semanas, valor (autocompletado por precio de temporada),
  estado de pago, fecha de inscripción y opción de mover entre temporadas.
- 🍪 Musicafé con catálogo de precios editable por categorías y cuenta semanal acumulada.
- 🚌 Ruta con semáforo de viabilidad (mínimo configurable).
- 📈 Estadísticas comparativas entre temporadas.

## Puesta en marcha

Ver **[PASOS.md](PASOS.md)** para la configuración de Firebase, reglas, conexión a la base
general, importación de clientes antiguos y despliegue en Hosting.

## Estructura

```
index.html              · carga la app
firebase-config.js      · credenciales del proyecto principal + correos permitidos
firebase-base-general.js· credenciales y mapeo de la base general
firestore.rules         · reglas de seguridad
js/                     · app, firebase, db, ui, dedup, catálogos
js/modules/             · un archivo por módulo
migracion/              · importador de clientes antiguos
legacy/                 · versión anterior (Google Apps Script), solo referencia
```
