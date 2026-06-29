// Módulo Tablero: resumen de la temporada.
import { el, cop } from "../ui.js?v=3";
import { listar } from "../db.js?v=5";
import { ESTADOS_CONTACTO, RUTA_MINIMO, semanasDetalle, semanaActualInfo } from "../catalogos.js?v=4";
import { listarPagos } from "../db.js?v=5";
import { totalPagado } from "../pagos.js?v=1";

export default async function render(root, ctx) {
  root.append(el("div", { class: "panel-head" },
    el("h2", {}, "📊 Tablero"),
    el("div", { class: "muted" }, ctx.temporada?.nombre || ctx.temporadaId)));

  const cont = el("div", {});
  root.append(cont);
  cont.append(el("div", { class: "panel" }, el("div", { class: "muted" }, "Cargando…")));

  const [contactos, inscripciones, musicafe, grupos] = await Promise.all([
    listar(ctx.temporadaId, "contactos"),
    listar(ctx.temporadaId, "inscripciones"),
    listar(ctx.temporadaId, "musicafe"),
    listar(ctx.temporadaId, "grupos"),
  ]);

  const interesados = contactos.filter((c) => ["Interesado", "Contactado", "En seguimiento", "Confirmado"].includes(c.estado)).length;
  const antiguos = contactos.filter((c) => c.estado === "Antiguo").length;
  const ingresos = inscripciones.reduce((s, d) => s + (Number(d.valor) || 0), 0);
  await Promise.all(inscripciones.map(async (d) => {
    d.pagos = await listarPagos(ctx.temporadaId, d.id);
    d.pagosCargados = true;
  }));
  const recaudado = inscripciones.reduce((s, d) => s + totalPagado(d), 0);
  const conRuta = inscripciones.filter((d) => d.ruta).length + contactos.filter((d) => d.ruta).length;
  const musicafeTotal = musicafe.reduce((s, d) => s + (Number(d.total) || 0), 0);

  cont.innerHTML = "";
  cont.append(tarjetaSemanaActual(ctx.temporada));
  cont.append(el("div", { class: "cards-row" },
    stat("Interesados", interesados),
    stat("Clientes antiguos", antiguos),
    stat("Inscritos", inscripciones.length, "ok"),
    stat("Clases asignadas", grupos.length),
  ));
  cont.append(el("div", { class: "cards-row" },
    stat("Ingresos esperados", cop(ingresos)),
    stat("Recaudado", cop(recaudado), "ok"),
    stat("Por cobrar", cop(ingresos - recaudado), ingresos - recaudado > 0 ? "warn" : "ok"),
    stat("Cuenta Musicafé", cop(musicafeTotal)),
  ));

  // Ruta
  const viable = conRuta >= RUTA_MINIMO;
  cont.append(el("div", { class: "panel ruta-status " + (viable ? "ok" : "warn") },
    el("div", { class: "ruta-big" }, viable ? "✅" : "🚌"),
    el("div", {}, el("div", { class: "stat-val" }, `${conRuta} / ${RUTA_MINIMO}`),
      el("div", { class: "stat-lbl" }, viable ? "Ruta viable" : `Faltan ${RUTA_MINIMO - conRuta} para la ruta`))));

  // Contactos según en qué etapa van
  const panel = el("div", { class: "panel" });
  panel.append(el("h3", {}, "Contactos según su etapa"));
  const tb = el("tbody", {});
  ESTADOS_CONTACTO.forEach((e) => {
    const n = contactos.filter((c) => c.estado === e).length;
    if (n) tb.append(el("tr", {}, el("td", {}, e), el("td", {}, String(n))));
  });
  if (!tb.children.length) panel.append(el("div", { class: "empty" }, "Aún no hay contactos cargados."));
  else panel.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
    el("thead", {}, el("tr", {}, el("th", {}, "Estado"), el("th", {}, "Cantidad"))), tb)));

  // Inscritos por grupo
  const panel2 = el("div", { class: "panel" });
  panel2.append(el("h3", {}, "Inscritos por grupo"));
  const porGrupo = {};
  inscripciones.forEach((i) => { const g = i.grupo || "Sin grupo"; porGrupo[g] = (porGrupo[g] || 0) + 1; });
  const claves = Object.keys(porGrupo);
  if (!claves.length) panel2.append(el("div", { class: "empty" }, "Sin inscritos."));
  else {
    const tb2 = el("tbody", {});
    claves.forEach((g) => tb2.append(el("tr", {}, el("td", {}, g), el("td", {}, String(porGrupo[g])))));
    panel2.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
      el("thead", {}, el("tr", {}, el("th", {}, "Grupo"), el("th", {}, "Inscritos"))), tb2)));
  }

  cont.append(el("div", { class: "grid-2" }, panel, panel2));
}

function stat(lbl, val, tono = "") {
  return el("div", { class: "stat " + tono }, el("div", { class: "stat-val" }, String(val)), el("div", { class: "stat-lbl" }, lbl));
}

function fechaLocal(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function inicioDia(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

function fmtRangoSemana(semana) {
  const desde = fechaLocal(semana.desde);
  const hasta = fechaLocal(semana.hasta);
  const fmt = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });
  if (desde && hasta) return `${fmt.format(desde)} - ${fmt.format(hasta)}`;
  if (desde) return `Desde ${fmt.format(desde)}`;
  if (hasta) return `Hasta ${fmt.format(hasta)}`;
  return "";
}

function semanaActual(temporada) {
  const semanas = semanasDetalle(temporada).filter((s) => s.desde || s.hasta);
  const hoy = inicioDia(new Date());
  const actual = semanas.find((s) => {
    const desde = fechaLocal(s.desde);
    const hasta = fechaLocal(s.hasta);
    return (!desde || hoy >= desde) && (!hasta || hoy <= hasta);
  });
  if (actual) return { estado: "actual", semana: actual };
  const siguiente = semanas.find((s) => {
    const desde = fechaLocal(s.desde);
    return desde && hoy < desde;
  });
  if (siguiente) return { estado: "proxima", semana: siguiente };
  const ultima = semanas[semanas.length - 1];
  return ultima ? { estado: "terminada", semana: ultima } : { estado: "sin-fechas", semana: null };
}

function tarjetaSemanaActual(temporada) {
  const info = semanaActualInfo(temporada);
  if (info.estado === "sin-fechas") {
    return el("div", { class: "panel week-status warn" },
      el("div", { class: "week-status-icon" }, "📅"),
      el("div", {},
        el("div", { class: "stat-val" }, "Sin fechas de semanas"),
        el("div", { class: "stat-lbl" }, "Configura las fechas en Info temporada")));
  }
  const texto = info.estado === "actual"
    ? "Estamos en esta semana"
    : info.estado === "proxima"
      ? "La temporada aún no llega a esta semana"
      : "La temporada ya terminó";
  const clase = info.estado === "actual" ? "ok" : "warn";
  return el("div", { class: "panel week-status " + clase },
    el("div", { class: "week-status-icon" }, "📅"),
    el("div", {},
      el("div", { class: "stat-val" }, info.semana.nombre),
      el("div", { class: "stat-lbl" }, `${texto}${fmtRangoSemana(info.semana) ? " · " + fmtRangoSemana(info.semana) : ""}`)));
}
