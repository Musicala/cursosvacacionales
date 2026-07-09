// Módulo Asistencia: marca diaria por estudiante inscrito.
import { el, toast, hoyISO } from "../ui.js?v=3";
import { listar, crear, actualizar } from "../db.js?v=3";
import { ASISTENCIA, nombreGrupo, semanasDetalle, diasDe } from "../catalogos.js?v=5";

export default async function render(root, ctx) {
  root.append(el("div", { class: "panel-head" }, el("h2", {}, "📝 Asistencia")));

  const fFecha = el("input", { type: "date", value: hoyISO() });
  root.append(el("div", { class: "panel" }, el("div", { class: "filters" },
    el("label", {}, "Fecha", fFecha),
    el("div", { class: "muted small" }, "Marca el estado de cada estudiante; se guarda al instante."))));

  const cont = el("div", { class: "panel" });
  root.append(cont);

  const inscritos = (await listar(ctx.temporadaId, "inscripciones")).map((d) => ({ ...d, grupo: nombreGrupo(d.grupo) }));
  const semanas = semanasDetalle(ctx.temporada);
  const diasTemporada = diasDe(ctx.temporada);

  async function pintar() {
    const fecha = fFecha.value;
    const registros = await listar(ctx.temporadaId, "asistencia");
    const mapa = {};
    registros.filter((r) => r.fecha === fecha).forEach((r) => (mapa[r.inscripcionId] = r));
    const infoFecha = infoAsistenciaFecha(fecha, semanas, diasTemporada);
    const visibles = infoFecha.semana
      ? inscritos.filter((ins) => vieneEnFecha(ins, infoFecha, diasTemporada))
      : inscritos;

    cont.innerHTML = "";
    if (!inscritos.length) {
      cont.append(el("div", { class: "empty" }, "No hay estudiantes inscritos todavía."));
      return;
    }
    cont.append(el("div", { class: "muted small" }, textoFiltroFecha(infoFecha, visibles.length, inscritos.length)));
    if (!visibles.length) {
      cont.append(el("div", { class: "empty" }, infoFecha.semana
        ? "No hay estudiantes programados para esta fecha."
        : "No hay estudiantes para mostrar."));
      return;
    }

    const tb = el("tbody", {});
    visibles.forEach((ins) => {
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

function fechaLocal(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function inicioDia(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

function infoAsistenciaFecha(iso, semanas, diasTemporada) {
  const fecha = fechaLocal(iso);
  if (!fecha) return { semana: "", dia: "" };
  const fechaDia = inicioDia(fecha);
  const dia = diasTemporada[fecha.getDay() - 1] || "";
  const actual = (semanas || []).find((s) => {
    const desde = fechaLocal(s.desde);
    const hasta = fechaLocal(s.hasta);
    return (desde || hasta) && (!desde || fechaDia >= desde) && (!hasta || fechaDia <= hasta);
  });
  return { semana: actual ? actual.nombre : "", dia };
}

function diasInscritoSemana(ins, semana, diasTemporada) {
  const porSemana = ins.diasPorSemana || {};
  const dias = Array.isArray(porSemana[semana]) ? porSemana[semana] : diasTemporada;
  return dias.filter((dia) => diasTemporada.includes(dia));
}

function vieneEnFecha(ins, infoFecha, diasTemporada) {
  if (!infoFecha.semana || !(ins.semanas || []).includes(infoFecha.semana)) return false;
  if (!infoFecha.dia) return true;
  return diasInscritoSemana(ins, infoFecha.semana, diasTemporada).includes(infoFecha.dia);
}

function textoFiltroFecha(infoFecha, visibles, total) {
  if (!infoFecha.semana) return `No se encontró una semana configurada para esta fecha; mostrando ${total} inscritos de la temporada.`;
  const dia = infoFecha.dia ? `, ${infoFecha.dia}` : "";
  return `Mostrando ${visibles} de ${total} inscritos programados para ${infoFecha.semana}${dia}.`;
}
