// Módulo Materiales: lista de insumos por taller/docente para alistar salones.
import { el, toast, modal, confirmar } from "../ui.js";
import { listar, crear, actualizar, eliminar } from "../db.js";
import { AREAS, semanasDe, diasDe } from "../catalogos.js";

export default async function render(root, ctx) {
  root.append(el("div", { class: "panel-head" },
    el("h2", {}, "📦 Materiales"),
    el("div", { class: "right" }, el("button", { class: "btn primary", onclick: () => editar(ctx, null, cargar) }, "+ Material")),
  ));

  const cont = el("div", { class: "panel" });
  root.append(cont);

  let datos = [];
  async function cargar() { datos = await listar(ctx.temporadaId, "materiales"); pintar(); }
  function pintar() {
    cont.innerHTML = "";
    if (!datos.length) { cont.append(el("div", { class: "empty" }, "Sin materiales listados. Agrega los insumos por taller para no correr el día de la clase.")); return; }
    const tb = el("tbody", {});
    datos.forEach((d) => tb.append(el("tr", { class: d.listo ? "done" : "" },
      el("td", {}, el("input", { type: "checkbox", ...(d.listo ? { checked: "checked" } : {}), onchange: async (e) => { await actualizar(ctx.temporadaId, "materiales", d.id, { listo: e.target.checked }); cargar(); } })),
      el("td", {}, el("strong", {}, d.material)),
      el("td", {}, d.cantidad || ""),
      el("td", {}, d.taller || ""), el("td", {}, d.area || ""),
      el("td", {}, d.semana || ""), el("td", {}, d.docente || ""), el("td", {}, d.salon || ""),
      el("td", { class: "row-actions" },
        el("button", { class: "btn ghost small", onclick: () => editar(ctx, d, cargar) }, "Editar"),
        el("button", { class: "btn ghost small", onclick: () => del(ctx, d, cargar) }, "🗑")),
    )));
    cont.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
      el("thead", {}, el("tr", {}, ...["✔", "Material", "Cant.", "Taller", "Área", "Semana", "Docente", "Salón", ""].map((h) => el("th", {}, h)))), tb)));
  }
  await cargar();
}

function editar(ctx, dato, onSave) {
  const SEMANAS = semanasDe(ctx.temporada);
  const DIAS = diasDe(ctx.temporada);
  const d = dato || {};
  const f = {};
  const inp = (k, ph) => { const i = el("input", { type: "text", placeholder: ph || "" }); if (d[k] != null) i.value = d[k]; f[k] = i; return i; };
  const sel = (k, ops) => { const s = el("select", {}, ...ops.map((o) => { const op = el("option", { value: o }, o || "—"); if (d[k] === o) op.selected = true; return op; })); f[k] = s; return s; };
  const grid = el("div", { class: "form-grid" },
    el("label", { class: "full" }, "Material", inp("material", "Ej: Cartulina, témperas, papel crepé…")),
    el("label", {}, "Cantidad", inp("cantidad", "Ej: 20")),
    el("label", {}, "Área", sel("area", ["", ...AREAS])),
    el("label", {}, "Semana", sel("semana", ["", ...SEMANAS])),
    el("label", {}, "Día", sel("dia", ["", ...DIAS])),
    el("label", {}, "Docente", inp("docente")),
    el("label", {}, "Salón", inp("salon")),
    el("label", { class: "full" }, "Taller / Temática", inp("taller")),
  );
  modal(dato ? "Editar material" : "Nuevo material", grid, [
    { texto: "Cancelar", clase: "ghost" },
    { texto: "Guardar", clase: "primary", onClick: async (dlg) => {
      if (!f.material.value.trim()) { toast("Falta el material", "error"); return; }
      const payload = { material: f.material.value.trim(), cantidad: f.cantidad.value.trim(), area: f.area.value, semana: f.semana.value, dia: f.dia.value, docente: f.docente.value.trim(), salon: f.salon.value.trim(), taller: f.taller.value.trim() };
      if (dato) await actualizar(ctx.temporadaId, "materiales", dato.id, payload); else await crear(ctx.temporadaId, "materiales", payload);
      dlg.close(); toast("Guardado"); onSave && onSave();
    } },
  ]);
}
function del(ctx, dato, onSave) { confirmar("¿Eliminar este material?", async () => { await eliminar(ctx.temporadaId, "materiales", dato.id); toast("Eliminado"); onSave && onSave(); }); }
