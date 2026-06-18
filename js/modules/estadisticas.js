// Módulo Estadísticas: compara todas las temporadas (inscritos, ingresos, recaudo…).
import { el, cop, fmtCorta } from "../ui.js?v=3";
import { listarTemporadas, listar } from "../db.js?v=3";

export default async function render(root, ctx) {
  root.append(el("div", { class: "panel-head" }, el("h2", {}, "📈 Estadísticas")));

  const cont = el("div", {});
  root.append(cont);
  cont.append(el("div", { class: "panel" }, el("div", { class: "muted" }, "Calculando…")));

  const temporadas = await listarTemporadas();

  // Cargar inscripciones y musicafé de cada temporada en paralelo.
  const datos = await Promise.all(temporadas.map(async (t) => {
    const [ins, caf] = await Promise.all([
      listar(t.id, "inscripciones"),
      listar(t.id, "musicafe"),
    ]);
    const ingresos = ins.reduce((s, d) => s + (Number(d.valor) || 0), 0);
    const recaudado = ins.filter((d) => d.estadoPago === "Pagado").reduce((s, d) => s + (Number(d.valor) || 0), 0);
    const conRuta = ins.filter((d) => d.ruta).length;
    const musicafe = caf.reduce((s, d) => s + (Number(d.total) || 0), 0);
    return {
      t, inscritos: ins.length, ingresos, recaudado, porCobrar: ingresos - recaudado,
      promedio: ins.length ? Math.round(ingresos / ins.length) : 0, conRuta, musicafe,
    };
  }));

  cont.innerHTML = "";

  // ----- Totales históricos -----
  const tot = datos.reduce((a, d) => ({
    inscritos: a.inscritos + d.inscritos, ingresos: a.ingresos + d.ingresos,
    recaudado: a.recaudado + d.recaudado, musicafe: a.musicafe + d.musicafe,
  }), { inscritos: 0, ingresos: 0, recaudado: 0, musicafe: 0 });

  cont.append(el("div", { class: "cards-row" },
    stat("Temporadas", temporadas.length),
    stat("Inscritos (histórico)", tot.inscritos),
    stat("Ingresos (histórico)", cop(tot.ingresos)),
    stat("Recaudado (histórico)", cop(tot.recaudado), "ok"),
  ));

  // ----- Tabla comparativa -----
  const panel = el("div", { class: "panel" });
  panel.append(el("h3", {}, "Comparativo por temporada"));
  if (!datos.length) { panel.append(el("div", { class: "empty" }, "Aún no hay temporadas.")); cont.append(panel); return; }

  const tb = el("tbody", {});
  datos.forEach((d) => {
    const rango = d.t.fechaInicio ? `${fmtCorta(d.t.fechaInicio)}${d.t.fechaFin ? " – " + fmtCorta(d.t.fechaFin) : ""}` : "—";
    tb.append(el("tr", { class: d.t.id === ctx.temporadaId ? "fila-activa" : "" },
      el("td", {}, el("strong", {}, d.t.nombre || d.t.id)),
      el("td", {}, rango),
      el("td", {}, String(d.inscritos)),
      el("td", {}, cop(d.ingresos)),
      el("td", {}, cop(d.recaudado)),
      el("td", {}, cop(d.porCobrar)),
      el("td", {}, cop(d.promedio)),
      el("td", {}, String(d.conRuta)),
      el("td", {}, cop(d.musicafe)),
    ));
  });
  panel.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
    el("thead", {}, el("tr", {},
      ...["Temporada", "Fechas", "Inscritos", "Ingresos", "Recaudado", "Por cobrar", "Valor promedio", "Con ruta", "Musicafé"].map((h) => el("th", {}, h)))),
    tb)));
  cont.append(panel);

  // ----- Barras simples de inscritos por temporada -----
  const max = Math.max(1, ...datos.map((d) => d.inscritos));
  const pBar = el("div", { class: "panel" });
  pBar.append(el("h3", {}, "Inscritos por temporada"));
  datos.slice().reverse().forEach((d) => {
    pBar.append(el("div", { class: "bar-row" },
      el("div", { class: "bar-lbl" }, d.t.nombre || d.t.id),
      el("div", { class: "bar-track" }, el("div", { class: "bar-fill", style: `width:${(d.inscritos / max) * 100}%` })),
      el("div", { class: "bar-val" }, String(d.inscritos))));
  });
  cont.append(pBar);
}

function stat(lbl, val, tono = "") {
  return el("div", { class: "stat " + tono }, el("div", { class: "stat-val" }, String(val)), el("div", { class: "stat-lbl" }, lbl));
}
