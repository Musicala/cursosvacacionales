import { onAuth, login, logout, correoPermitido, resultadoRedirect } from "./firebase.js?v=4";
import { $, el, toast, fmtCorta } from "./ui.js?v=4";
import { listarTemporadas, crearTemporada } from "./db.js?v=5";

import dashboard from "./modules/dashboard.js?v=7";
import estadisticas from "./modules/estadisticas.js?v=6";
import contactos from "./modules/contactos.js?v=11";
import inscripciones from "./modules/inscripciones.js?v=7";
import horarios from "./modules/horarios.js?v=8";
import asistencia from "./modules/asistencia.js?v=6";
import musicafe from "./modules/musicafe.js?v=6";
import ruta from "./modules/ruta.js?v=4";
import materiales from "./modules/materiales.js?v=4";
import musipuntos from "./modules/musipuntos.js?v=4";
import temporadaInfo, { formularioTemporada } from "./modules/temporada.js?v=5";
import cotizador from "./modules/cotizador.js?v=5";
import { conectarConCredencial } from "./base-general.js?v=4";
import { leerConfig } from "./db.js?v=5";
import { migrarNombresGrupos } from "./migraciones.js?v=1";

const MODULOS = [
  { id: "dashboard",     nombre: "Tablero",        icono: "📊", render: dashboard },
  { id: "contactos",     nombre: "Contactos",      icono: "📇", render: contactos },
  { id: "inscripciones", nombre: "Inscripciones",  icono: "✅", render: inscripciones },
  { id: "horarios",      nombre: "Horarios y docentes", icono: "🗓️", render: horarios },
  { id: "asistencia",    nombre: "Asistencia",     icono: "📝", render: asistencia },
  { id: "musicafe",      nombre: "Musicafé",       icono: "🍪", render: musicafe },
  { id: "ruta",          nombre: "Ruta",           icono: "🚌", render: ruta },
  { id: "materiales",    nombre: "Materiales",     icono: "📦", render: materiales },
  { id: "musipuntos",    nombre: "Musipuntos",     icono: "⭐", render: musipuntos },
  { id: "temporada",     nombre: "Info temporada", icono: "📅", render: temporadaInfo },
  { id: "cotizador",     nombre: "Cotizador",      icono: "🧮", render: cotizador },
  { id: "estadisticas",  nombre: "Estadísticas",   icono: "📈", render: estadisticas },
];

// Módulos que puede ver el rol Docente (en este orden).
const MODULOS_DOCENTE = ["horarios", "asistencia", "musicafe", "materiales", "musipuntos"];

const estado = {
  usuario: null,
  rol: "admin",          // "admin" | "docente"
  docente: null,         // registro del docente si rol === "docente"
  temporadaId: localStorage.getItem("temporadaId") || null,
  temporadas: [],
  moduloActivo: "dashboard",
};

// Módulos visibles según el rol actual.
function modulosVisibles() {
  if (estado.rol === "docente") return MODULOS.filter((m) => MODULOS_DOCENTE.includes(m.id));
  return MODULOS;
}

// ---------- Arranque / autenticación ----------
// Si la sesión llegó por redirect (respaldo cuando el popup no se pudo),
// recuperamos la credencial para conectar también la base general.
resultadoRedirect().then(async (cred) => {
  if (cred) {
    try { await conectarConCredencial(cred); } catch (e) { console.warn("No se pudo conectar base general tras redirect", e); }
  }
});

onAuth(async (user) => {
  if (!user) return mostrarLogin();
  const correo = (user.email || "").toLowerCase();

  if (correoPermitido(correo)) {
    estado.rol = "admin";
    estado.docente = null;
  } else {
    // ¿Es un docente registrado? (su correo está en config/global → docentes).
    let docente;
    try {
      docente = await buscarDocentePorCorreo(correo);
    } catch (e) {
      await logout();
      return mostrarErrorAcceso(
        "No pudimos verificar el acceso docente.",
        "La sesión de Google entró, pero Firestore no permitió leer la lista de docentes. Revisa que las reglas publicadas permitan leer config/global y que el correo esté guardado en Docentes."
      );
    }
    if (!docente) {
      toast("Ese correo no tiene acceso: " + user.email, "error");
      await logout();
      return mostrarLogin();
    }
    estado.rol = "docente";
    estado.docente = docente;
    // El docente arranca en su horario (no tiene tablero).
    estado.moduloActivo = "horarios";
  }

  estado.usuario = user;
  await iniciarApp();
});

// Busca en la configuración un docente cuyo correo coincida.
async function buscarDocentePorCorreo(correo) {
  const cfg = await leerConfig();
  const docs = (cfg && Array.isArray(cfg.docentes)) ? cfg.docentes : [];
  return docs.find((d) => (d.correo || "").toLowerCase() === correo) || null;
}

function mostrarLogin() {
  estado.usuario = null;
  document.body.innerHTML = "";
  const card = el("div", { class: "login-card" },
    el("img", { src: "logo.png", alt: "Musicala", class: "login-logo" }),
    el("h1", {}, "Cursos Vacacionales"),
    el("p", { class: "muted" }, "Panel de coordinación · Musicala"),
    el("button", { class: "btn primary big", onclick: async () => {
      try {
        const cred = await login();
        // Conecta también la base general con el mismo login (sin segundo popup).
        if (cred) await conectarConCredencial(cred);
      } catch (e) {
        const detalle = e && (e.code || e.message) ? ` (${e.code || e.message})` : "";
        toast("No se pudo iniciar sesión" + detalle, "error");
      }
    } }, "Entrar con Google"),
    el("p", { class: "muted small" }, "Acceso solo para correos autorizados."),
  );
  document.body.append(el("div", { class: "login-wrap" }, card));
}

function mostrarErrorAcceso(titulo, detalle) {
  estado.usuario = null;
  document.body.innerHTML = "";
  const card = el("div", { class: "login-card" },
    el("img", { src: "logo.png", alt: "Musicala", class: "login-logo" }),
    el("h1", {}, titulo),
    el("p", { class: "muted" }, detalle),
    el("button", { class: "btn primary big", onclick: mostrarLogin }, "Intentar de nuevo"),
  );
  document.body.append(el("div", { class: "login-wrap" }, card));
}

async function iniciarApp() {
  estado.temporadas = await listarTemporadas();
  if (!estado.temporadas.length && estado.rol === "admin") {
    // Crear una temporada inicial automáticamente (solo coordinación).
    await crearTemporada("2026-junio", { nombre: "Junio 2026", orden: 202606, activa: true });
    estado.temporadas = await listarTemporadas();
  }
  if (!estado.temporadas.length) {
    // Sin temporadas (p. ej. un docente entra antes de que coordinación cree una).
    document.body.innerHTML = "";
    document.body.append(el("div", { class: "login-wrap" },
      el("div", { class: "login-card" },
        el("h1", {}, "Aún no hay temporadas"),
        el("p", { class: "muted" }, "Pídele a coordinación que cree la temporada para ver tu horario."),
        el("button", { class: "btn ghost", onclick: () => logout() }, "Salir"))));
    return;
  }
  if (!estado.temporadaId || !estado.temporadas.find((t) => t.id === estado.temporadaId)) {
    estado.temporadaId = estado.temporadas[0].id;
  }
  construirShell();
  navegar(estado.moduloActivo);

  // Migración única: renombra los grupos guardados con nombres viejos.
  // Corre en segundo plano para no demorar el arranque; si cambió algo,
  // repinta el módulo activo para mostrar los datos ya actualizados.
  if (estado.rol === "admin") {
    migrarNombresGrupos(estado.temporadas)
      .then((cambiados) => {
        if (cambiados) {
          toast(`Se actualizaron ${cambiados} registro(s) a los nuevos nombres de grupos`);
          navegar(estado.moduloActivo);
        }
      })
      .catch((e) => console.warn("Migración de nombres de grupos falló", e));
  }
}

// ---------- Shell (sidebar + topbar + contenido) ----------
function construirShell() {
  document.body.innerHTML = "";

  const nav = el("nav", { class: "sidebar" },
    el("div", { class: "side-brand" },
      el("img", { src: "logo.png", alt: "Musicala" }),
      el("div", {}, el("strong", {}, "Vacacionales"), el("div", { class: "muted small" }, "Musicala")),
    ),
    ...modulosVisibles().map((m) => el("a", {
      class: "side-link", "data-mod": m.id,
      onclick: () => { navegar(m.id); cerrarMenu(); },
    }, el("span", { class: "ico" }, m.icono), el("span", {}, m.nombre))),
  );

  const selTemp = el("select", { class: "sel-temp", onchange: (e) => {
    estado.temporadaId = e.target.value;
    localStorage.setItem("temporadaId", estado.temporadaId);
    navegar(estado.moduloActivo);
  } });
  estado.temporadas.forEach((t) => {
    const rango = t.fechaInicio ? ` (${fmtCorta(t.fechaInicio)}${t.fechaFin ? "–" + fmtCorta(t.fechaFin) : ""})` : "";
    const o = el("option", { value: t.id }, (t.nombre || t.id) + rango);
    if (t.id === estado.temporadaId) o.selected = true;
    selTemp.append(o);
  });

  const menuBtn = el("button", {
    class: "menu-btn", "aria-label": "Abrir menú",
    onclick: () => document.body.classList.toggle("nav-abierto"),
  }, "☰");

  const topbar = el("header", { class: "topbar" },
    menuBtn,
    el("div", { class: "top-left" },
      el("span", { class: "muted small top-temp-lbl" }, "Temporada:"), selTemp,
      estado.rol === "admin"
        ? el("button", { class: "btn ghost small", title: "Nueva temporada", onclick: nuevaTemporada }, "+ Temporada")
        : null,
    ),
    el("div", { class: "top-right" },
      estado.rol === "docente"
        ? el("span", { class: "pill" }, "Docente · " + (estado.docente?.nombre || ""))
        : null,
      el("span", { class: "muted small top-email" }, estado.usuario.email),
      el("button", { class: "btn ghost small", onclick: () => logout() }, "Salir"),
    ),
  );

  const overlay = el("div", { class: "nav-overlay", onclick: cerrarMenu });
  const main = el("main", { class: "content", id: "content" });
  const layout = el("div", { class: "layout" }, nav, overlay, el("div", { class: "main-col" }, topbar, main));
  document.body.append(layout);
}

// Cierra el menú lateral en móvil (no afecta escritorio).
function cerrarMenu() {
  document.body.classList.remove("nav-abierto");
}

function nuevaTemporada() {
  // Formulario compartido con el módulo "Info temporada" (nombre, fechas, etc.)
  formularioTemporada(null, async (datos) => {
    const id = (datos.nombre || "").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
    if (!id) { toast("Ponle un nombre a la temporada", "error"); return false; }
    if (estado.temporadas.find((t) => t.id === id)) { toast("Ya existe una temporada con ese nombre", "error"); return false; }
    const orden = Number((datos.fechaInicio || "").replace(/-/g, "").slice(0, 6) ||
      (new Date().getFullYear() + "" + String(new Date().getMonth() + 1).padStart(2, "0")));
    await crearTemporada(id, { ...datos, orden, activa: true });
    estado.temporadas = await listarTemporadas();
    estado.temporadaId = id;
    localStorage.setItem("temporadaId", id);
    construirShell();
    navegar("temporada");
    toast("Temporada creada");
    return true;
  });
}

// ---------- Router ----------
function navegar(modId) {
  const visibles = modulosVisibles();
  // Si el rol no puede ver el módulo pedido, cae al primero permitido.
  let mod = visibles.find((m) => m.id === modId);
  if (!mod) mod = visibles[0];
  estado.moduloActivo = mod.id;
  document.querySelectorAll(".side-link").forEach((a) =>
    a.classList.toggle("active", a.getAttribute("data-mod") === mod.id));
  const content = $("#content");
  content.innerHTML = "";
  const ctx = {
    temporadaId: estado.temporadaId,
    temporada: estado.temporadas.find((t) => t.id === estado.temporadaId),
    usuario: estado.usuario,
    rol: estado.rol,
    docente: estado.docente,
    irA: navegar,
  };
  try {
    mod.render(content, ctx);
  } catch (e) {
    console.error(e);
    content.append(el("div", { class: "panel error" }, "Error al cargar el módulo: " + e.message));
  }
}
