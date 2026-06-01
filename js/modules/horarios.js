// Módulo Horarios y docentes: asignación de clases por semana/día con docente, taller y salón.
import { el, toast, modal, confirmar } from "../ui.js";
import { listar, crear, actualizar, eliminar, leerConfig } from "../db.js";
import { GRUPOS, AREAS, DOCENTES, DIAS } from "../catalogos.js";

const SEMANAS = ["Semana 1", "Semana 2", "Semana 3", "Semana 4"];
let DOCS = DOCENTES;

export default async function render(root, ctx) {
  const cfg = await leerConfig();
  if (cfg && Array.isArray(cfg.docentes) && cfg.docentes.length) DOCS = cfg.docentes;

  root.append(el("div", { class: "panel-head" },
    el("h2", {}, "🗓️ Horarios y docentes"),
    el("div", { class: "right" },
      el("button", { class: "btn ghost", onclick: () => verDocentes() }, "Ver docentes"),
      el("button", { class: "btn primary", onclick: () => editar(ctx, null, cargar) }, "+ Asignar clase"),
    ),
  ));

  const fSemana = el("select", {}, ...["", ...SEMANAS].map((s) => el("option", { value: s }, s || "Todas las semanas")));
  root.append(el("div", { class: "panel" }, el("div", { class: "filters" }, el("label", {}, "Semana", fSemana))));

  const cont = el("div", { class: "panel" });
  root.append(cont);

  let datos = [];
  async function cargar() { datos = await listar(ctx.temporadaId, "grupos"); pintar(); }
  function pintar() {
    const sem = fSemana.value;
    const filas = datos.filter((d) => !sem || d.semana === sem);
    cont.innerHTML = "";
    if (!filas.length) { cont.append(el("div", { class: "empty" }, "Sin clases asignadas. Usa “+ Asignar clase”.")); return; }
    const tb = el("tbody", {});
    filas.sort((a, b) => (a.semana + a.dia).localeCompare(b.semana + b.dia));
    filas.forEach((d) => tb.append(el("tr", {},
      el("td", {}, d.semana), el("td", {}, d.dia), el("td", {}, d.grupo),
      el("td", {}, d.area), el("td", {}, d.taller || ""),
      el("td", {}, el("strong", {}, d.docente || "—")), el("td", {}, d.salon || ""),
      el("td", { class: "row-actions" },
        el("button", { class: "btn ghost small", onclick: () => editar(ctx, d, cargar) }, "Editar"),
        el("button", { class: "btn ghost small", onclick: () => del(ctx, d, cargar) }, "🗑")),
    )));
    cont.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
      el("thead", {}, el("tr", {}, ...["Semana", "Día", "Grupo", "Área", "Taller/Temática", "Docente", "Salón", ""].map((h) => el("th", {}, h)))), tb)));
  }
  fSemana.onchange = pintar;
  await cargar();
}

function editar(ctx, dato, onSave) {
  const d = dato || {};
  const f = {};
  const sel = (k, ops) => { const s = el("select", {}, ...ops.map((o) => { const op = el("option", { value: o }, o || "—"); if (d[k] === o) op.selected = true; return op; })); f[k] = s; return s; };
  const inp = (k, ph) => { const i = el("input", { type: "text", placeholder: ph || "" }); if (d[k] != null) i.value = d[k]; f[k] = i; return i; };

  const grid = el("div", { class: "form-grid" },
    el("label", {}, "Semana", sel("semana", SEMANAS)),
    el("label", {}, "Día", sel("dia", DIAS)),
    el("label", {}, "Grupo", sel("grupo", GRUPOS.map((g) => g.nombre))),
    el("label", {}, "Área", sel("area", AREAS)),
    el("label", {}, "Docente", sel("docente", ["", ...DOCS.map((x) => x.nombre)])),
    el("label", {}, "Salón", inp("salon", "Ej: Salón 2")),
    el("label", { class: "full" }, "Taller / Temática", inp("taller", "Ej: Navidad, Películas, Disney…")),
  );
  modal(dato ? "Editar clase" : "Asignar clase", grid, [
    { texto: "Cancelar", clase: "ghost" },
    { texto: "Guardar", clase: "primary", onClick: async (dlg) => {
      const payload = { semana: f.semana.value, dia: f.dia.value, grupo: f.grupo.value, area: f.area.value, docente: f.docente.value, salon: f.salon.value.trim(), taller: f.taller.value.trim() };
      try {
        if (dato) await actualizar(ctx.temporadaId, "grupos", dato.id, payload);
        else await crear(ctx.temporadaId, "grupos", payload);
        dlg.close(); toast("Guardado"); onSave && onSave();
      } catch (e) { toast("Error: " + e.message, "error"); }
    } },
  ]);
}

function verDocentes() {
  const titulares = DOCS.filter((d) => !d.reemplazo);
  const reemplazos = DOCS.filter((d) => d.reemplazo);
  const tabla = (lista) => el("div", { class: "table-wrap" }, el("table", { class: "table" },
    el("thead", {}, el("tr", {}, el("th", {}, "Docente"), el("th", {}, "Áreas"))),
    el("tbody", {}, ...lista.map((x) => el("tr", {}, el("td", {}, x.nombre), el("td", {}, (x.areas || []).join(", ")))))));
  const body = el("div", {},
    el("h4", {}, "Docentes"), tabla(titulares),
    el("h4", {}, "Reemplazos (emergencias)"), reemplazos.length ? tabla(reemplazos) : el("div", { class: "muted" }, "—"));
  modal("Docentes", body, [{ texto: "Cerrar", clase: "primary" }]);
}

function del(ctx, dato, onSave) {
  confirmar("¿Eliminar esta clase?", async () => { await eliminar(ctx.temporadaId, "grupos", dato.id); toast("Eliminado"); onSave && onSave(); });
}
