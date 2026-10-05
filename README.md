# Cursos Vacacionales · Musicala

Aplicativo web para coordinar los cursos vacacionales de Musicala: contactos e interesados,
inscripciones, horarios y docentes, asistencia, Musicafé (onces), ruta, materiales,
información por temporada y estadísticas. Construido con **Firebase** (Auth + Firestore + Hosting).

## Integración Wix Bookings (fase 1)

La sección **Configuración Wix** crea y administra la colección central
`vacationWorkshops`. Los horarios guardan únicamente `workshopId`; los Service ID
de Wix se conservan una sola vez en ese catálogo. Las clases antiguas sin esa
referencia siguen siendo verificables por compatibilidad, inferidas desde su área.

La verificación semanal es solo de lectura y consulta **List Event Time Slots** de
Wix para servicios `CLASS`. No crea reservas ni modifica sesiones.

Antes de desplegar las funciones, configura la clave administrativa exclusivamente
como secreto (no en `firebase-config.js` ni en archivos `.env` versionados):

```powershell
firebase functions:secrets:set WIX_API_KEY
firebase deploy --only functions:wixSessions
```

La clave necesita el permiso de Wix **Read Bookings Calendar Availability** y debe
tener acceso al Site ID configurado. El navegador se autentica con Firebase y llama
al endpoint seguro de Cloud Functions; la clave nunca se devuelve. GitHub Pages no
ejecuta los rewrites de Firebase Hosting, por lo que la URL de la función se
centraliza como `WIX_SESSIONS_URL` en `firebase-config.js`.

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
