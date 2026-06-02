# Cursos Vacacionales · Musicala — Puesta en marcha

App web para coordinar los cursos vacacionales: pipeline de contactos, inscripciones,
horarios/docentes, asistencia, Musicafé (onces), ruta y materiales. Backend en **Firebase**.

## 1. Crear el proyecto en Firebase (tú lo haces, ~10 min)

1. Entra a https://console.firebase.google.com → **Agregar proyecto** (ej: `musicala-vacacionales`).
2. **Build → Authentication → Get started → Sign-in method → Google → Habilitar.**
   - En "Correo de soporte" pon uno de los autorizados.
3. **Build → Firestore Database → Crear base de datos** → modo **producción** → región `nam5` (us).
4. **⚙️ Configuración del proyecto → Tus apps → Web (</>)** → registra una app web.
   - Copia el objeto `firebaseConfig` que te muestra.
5. Pega esos valores en **`firebase-config.js`** (reemplaza los `PEGA_AQUI...`).

## 2. Reglas de seguridad

En la consola, **Firestore → Reglas**, pega el contenido de `firestore.rules` y publica.
(Solo los 4 correos autorizados podrán leer/escribir.)

Para cambiar los correos: edítalos **en los dos lugares** → `firebase-config.js` y `firestore.rules`.

## 3. Probar en local

Desde esta carpeta:

```
python -m http.server 5500
```

Abre http://localhost:5500 → entra con Google → debe cargar el tablero.
(Si el correo no está autorizado, te saca automáticamente.)

## 4. Importar clientes antiguos (315 contactos del Excel)

1. Con el server local corriendo, abre http://localhost:5500/migracion/importar.html
2. Inicia sesión, confirma el ID de temporada (`2026-junio`) y pulsa **Importar ahora**.
3. Quedan como estado **"Antiguo"** en Contactos, listos para re-contactar.

> Para volver a generar el JSON desde otro Excel:
> `python migracion/exportar.py` (ver script).

## 4b. Conectar la BASE GENERAL (traer los de etiqueta "Vacacionales")

La app lee tu **otro** proyecto de Firebase (base general, estructura `sheetCache/{hoja}/rows`)
y trae a Contactos a quienes tengan **"Vacacionales"** en Listado, Arte I o Curso/Plan.

1. En `firebase-base-general.js`:
   - Pega el `firebaseConfig` del **otro** proyecto.
   - En `BG.CAMPOS_ETIQUETA`, confirma los nombres de las columnas de etiqueta.
   - En `BG.HOJAS`, déjalo `[]` para revisar todas las hojas, o pon los IDs de las hojas
     concretas (más rápido).
   - En `MAPEO_CAMPOS`, ajusta las claves a como se llaman las columnas en tu Google Sheet.
2. Reglas: **no hay que cambiarlas** — las actuales ya permiten lectura a los 4 correos.
3. En Authentication del **otro** proyecto, habilita **Google** y agrega `localhost`
   (y tu dominio de hosting) a Authorized domains.
4. En la app, entra a **Contactos** → pulsa **"Conectar base general"** una vez
   (segundo login con la misma cuenta). Después se sincroniza solo al abrir Contactos,
   trayendo los nuevos sin duplicar (por nombre, correo o teléfono).

## 5. Publicar en internet (Firebase Hosting)

```
npm install -g firebase-tools
firebase login
firebase use --add        # elige tu proyecto
firebase deploy
```

Te da una URL pública (`https://tu-proyecto.web.app`) para compartir con el equipo.

---

## Estructura del código

```
index.html            · carga la app
firebase-config.js    · TUS credenciales (editar) + lista de correos
firestore.rules       · seguridad (mismos correos)
firebase.json         · config de Hosting
js/
  app.js              · login, navegación, selector de temporada
  firebase.js         · init de Firebase + auth
  db.js               · lectura/escritura en Firestore (por temporada)
  catalogos.js        · grupos, paquetes, precios Musicafé, docentes, mínimo de ruta…
  ui.js               · helpers (modales, toasts, moneda)
  modules/            · un archivo por módulo (los 8)
migracion/            · JSON de clientes antiguos + importador
legacy/               · versión vieja (Google Apps Script), solo referencia
```

## Modelo de datos (Firestore)

```
temporadas/{id}                       → { nombre, orden, activa }
  /contactos/{id}                     → pipeline (interesados, antiguos)
  /inscripciones/{id}                 → inscritos (paquete, valor, pago, ruta)
  /grupos/{id}                        → clases (semana, día, área, docente, taller, salón)
  /asistencia/{id}                    → { fecha, inscripcionId, estado }
  /musicafe/{id}                      → { fecha, estudiante, productos[], total }
  /materiales/{id}                    → insumos por taller
config/global                         → catálogos editables (precios, docentes)
```

Cada temporada es independiente: se crea con **"+ Temporada"** y se cambia con el selector de arriba.
Adiós a las 33 hojas del Excel. 🎉
