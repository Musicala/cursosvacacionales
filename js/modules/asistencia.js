// Módulo Asistencia: marca diaria por estudiante inscrito.
import { el, toast, hoyISO } from "../ui.js?v=3";
import { listar, crear, actualizar } from "../db.js?v=3";
import { ASISTENCIA } from "../catalogos.js?v=3";

export default async function render(root, ctx) {
  root.append(el("div", { class: "panel-head" }, el("h2", {}, "📝 Asistencia")));

  const fFecha = el("input", { type: "date", value: hoyISO() });
  root.append(el("div", { class: "panel" }, el("div", { class: "filters" },
    el("label", {}, "Fecha", fFecha),
    el("div", { class: "muted small" }, "Marca el estado de cada estudiante; se guarda al instante."))));

  const cont = el("div", { class: "panel" });
  root.append(cont);

  const inscritos = await listar(ctx.temporadaId, "inscripciones");

  async function pintar() {
    const fecha = fFecha.value;
    const registros = await listar(ctx.temporadaId, "asistencia");
    const mapa = {};
    registros.filter((r) => r.fecha === fecha).forEach((r) => (mapa[r.inscripcionId] = r));
    cont.innerHTML = "";
    if (!inscritos.length) { cont.append(el("div", { class: "empty" }, "No hay estudiantes inscritos todavía.")); return; }
    const tb = el("tbody", {});
    inscritos.forEach((ins) => {
      const actual = mapa[ins.id];
      const sel = el("select", {}, ...ASISTENCIA.map((e) => {
        const op = el("option", { value: e }, e);
        if ((actual?.estado || "—") === e) op.selected = true;
        return op;
      }));
      sel.onchange = async () => {
        const estado = sel.value;
        try {
          if (actual?.id) await actualizar(ctx.temporadaId, "asistencia", actual.id, { estado });
          else {
            const id = await crear(ctx.temporadaId, "asistencia", { fecha, inscripcionId: ins.id, estudiante: ins.estudiante, estado });
            mapa[ins.id] = { id, estado };
          }
          toast("Asistencia guardada");
        } catch (e) { toast("Error: " + e.message, "error"); }
      };
      tb.append(el("tr", {},
        el("td", {}, el("strong", {}, ins.estudiante || "—")),
        el("td", {}, ins.grupo || ""),
        el("td", {}, sel)));
    });
    cont.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
      el("thead", {}, el("tr", {}, el("th", {}, "Estudiante"), el("th", {}, "Grupo"), el("th", {}, "Asistencia"))), tb)));
  }
  fFecha.onchange = pintar;
  await pintar();
}
