import { onAuth, login, logout, correoPermitido } from "./firebase.js";
import { $, el, toast } from "./ui.js";
import { listarTemporadas, crearTemporada } from "./db.js";

import dashboard from "./modules/dashboard.js";
import contactos from "./modules/contactos.js";
import inscripciones from "./modules/inscripciones.js";
import horarios from "./modules/horarios.js";
import asistencia from "./modules/asistencia.js";
import musicafe from "./modules/musicafe.js";
import ruta from "./modules/ruta.js";
import materiales from "./modules/materiales.js";

const MODULOS = [
  { id: "dashboard",     nombre: "Tablero",        icono: "📊", render: dashboard },
  { id: "contactos",     nombre: "Contactos",      icono: "📇", render: contactos },
  { id: "inscripciones", nombre: "Inscripciones",  icono: "✅", render: inscripciones },
  { id: "horarios",      nombre: "Horarios y docentes", icono: "🗓️", render: horarios },
  { id: "asistencia",    nombre: "Asistencia",     icono: "📝", render: asistencia },
  { id: "musicafe",      nombre: "Musicafé",       icono: "🍪", render: musicafe },
  { id: "ruta",          nombre: "Ruta",           icono: "🚌", render: ruta },
  { id: "materiales",    nombre: "Materiales",     icono: "📦", render: materiales },
];

const estado = {
  usuario: null,
  temporadaId: localStorage.getItem("temporadaId") || null,
  temporadas: [],
  moduloActivo: "dashboard",
};

// ---------- Arranque / autenticación ----------
onAuth(async (user) => {
  if (!user) return mostrarLogin();
  if (!correoPermitido(user.email)) {
    toast("Ese correo no tiene acceso: " + user.email, "error");
    await logout();
    return mostrarLogin();
  }
  estado.usuario = user;
  await iniciarApp();
});

function mostrarLogin() {
  estado.usuario = null;
  document.body.innerHTML = "";
  const card = el("div", { class: "login-card" },
    el("img", { src: "logo.png", alt: "Musicala", class: "login-logo" }),
    el("h1", {}, "Cursos Vacacionales"),
    el("p", { class: "muted" }, "Panel de coordinación · Musicala"),
    el("button", { class: "btn primary big", onclick: async () => {
      try { await login(); } catch (e) { toast("No se pudo iniciar sesión", "error"); }
    } }, "Entrar con Google"),
    el("p", { class: "muted small" }, "Acceso solo para correos autorizados."),
  );
  document.body.append(el("div", { class: "login-wrap" }, card));
}

async function iniciarApp() {
  estado.temporadas = await listarTemporadas();
  if (!estado.temporadas.length) {
    // Crear una temporada inicial automáticamente.
    await crearTemporada("2026-junio", { nombre: "Junio 2026", orden: 202606, activa: true });
    estado.temporadas = await listarTemporadas();
  }
  if (!estado.temporadaId || !estado.temporadas.find((t) => t.id === estado.temporadaId)) {
    estado.temporadaId = estado.temporadas[0].id;
  }
  construirShell();
  navegar(estado.moduloActivo);
}

// ---------- Shell (sidebar + topbar + contenido) ----------
function construirShell() {
  document.body.innerHTML = "";

  const nav = el("nav", { class: "sidebar" },
    el("div", { class: "side-brand" },
      el("img", { src: "logo.png", alt: "Musicala" }),
      el("div", {}, el("strong", {}, "Vacacionales"), el("div", { class: "muted small" }, "Musicala")),
    ),
    ...MODULOS.map((m) => el("a", {
      class: "side-link", "data-mod": m.id,
      onclick: () => navegar(m.id),
    }, el("span", { class: "ico" }, m.icono), el("span", {}, m.nombre))),
  );

  const selTemp = el("select", { class: "sel-temp", onchange: (e) => {
    estado.temporadaId = e.target.value;
    localStorage.setItem("temporadaId", estado.temporadaId);
    navegar(estado.moduloActivo);
  } });
  estado.temporadas.forEach((t) => {
    const o = el("option", { value: t.id }, t.nombre || t.id);
    if (t.id === estado.temporadaId) o.selected = true;
    selTemp.append(o);
  });

  const topbar = el("header", { class: "topbar" },
    el("div", { class: "top-left" },
      el("span", { class: "muted small" }, "Temporada:"), selTemp,
      el("button", { class: "btn ghost small", title: "Nueva temporada", onclick: nuevaTemporada }, "+ Temporada"),
    ),
    el("div", { class: "top-right" },
      el("span", { class: "muted small" }, estado.usuario.email),
      el("button", { class: "btn ghost small", onclick: () => logout() }, "Salir"),
    ),
  );

  const main = el("main", { class: "content", id: "content" });
  const layout = el("div", { class: "layout" }, nav, el("div", { class: "main-col" }, topbar, main));
  document.body.append(layout);
}

function nuevaTemporada() {
  const nombre = prompt("Nombre de la temporada (ej: Diciembre 2026):");
  if (!nombre) return;
  const id = nombre.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-]/g, "");
  const orden = Number(new Date().getFullYear() + "" + String(new Date().getMonth() + 1).padStart(2, "0"));
  crearTemporada(id, { nombre: nombre.trim(), orden, activa: true }).then(async () => {
    estado.temporadas = await listarTemporadas();
    estado.temporadaId = id;
    localStorage.setItem("temporadaId", id);
    construirShell();
    navegar(estado.moduloActivo);
    toast("Temporada creada");
  });
}

// ---------- Router ----------
function navegar(modId) {
  estado.moduloActivo = modId;
  const mod = MODULOS.find((m) => m.id === modId) || MODULOS[0];
  document.querySelectorAll(".side-link").forEach((a) =>
    a.classList.toggle("active", a.getAttribute("data-mod") === modId));
  const content = $("#content");
  content.innerHTML = "";
  const ctx = {
    temporadaId: estado.temporadaId,
    temporada: estado.temporadas.find((t) => t.id === estado.temporadaId),
    usuario: estado.usuario,
    irA: navegar,
  };
  try {
    mod.render(content, ctx);
  } catch (e) {
    console.error(e);
    content.append(el("div", { class: "panel error" }, "Error al cargar el módulo: " + e.message));
  }
}
