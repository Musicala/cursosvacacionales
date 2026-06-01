// Módulo Tablero: resumen de la temporada.
import { el, cop } from "../ui.js";
import { listar } from "../db.js";
import { ESTADOS_CONTACTO, RUTA_MINIMO } from "../catalogos.js";

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
  const recaudado = inscripciones.filter((d) => d.estadoPago === "Pagado").reduce((s, d) => s + (Number(d.valor) || 0), 0);
  const conRuta = inscripciones.filter((d) => d.ruta).length + contactos.filter((d) => d.ruta).length;
  const musicafeTotal = musicafe.reduce((s, d) => s + (Number(d.total) || 0), 0);

  cont.innerHTML = "";
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
