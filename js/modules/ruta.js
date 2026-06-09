// Módulo Ruta: interesados (contactos) y confirmados (inscritos), con viabilidad vs. el mínimo.
import { el, toast, modal } from "../ui.js";
import { listar, actualizar, obtenerTemporada, actualizarTemporada } from "../db.js";
import { RUTA_MINIMO } from "../catalogos.js";

export default async function render(root, ctx) {
  root.innerHTML = "";
  // Mínimo de la ruta: editable por temporada (se puede negociar con otra empresa).
  const temp = (await obtenerTemporada(ctx.temporadaId)) || {};
  const RUTA_MIN = Number(temp.rutaMinimo) > 0 ? Number(temp.rutaMinimo) : RUTA_MINIMO;

  root.append(el("div", { class: "panel-head" },
    el("h2", {}, "🚌 Ruta"),
    el("div", { class: "right" },
      el("button", { class: "btn ghost", onclick: () => editarMinimo() }, "⚙️ Mínimo requerido"),
    ),
  ));

  function editarMinimo() {
    const input = el("input", { type: "number", min: "1", value: String(RUTA_MIN) });
    const body = el("div", {},
      el("label", { class: "block-label" }, "Cantidad mínima de estudiantes para activar la ruta", input),
      el("p", { class: "muted small" }, "Ajústalo según lo que negocies con la empresa de transporte."));
    modal("Mínimo requerido para la ruta", body, [
      { texto: "Cancelar", clase: "ghost" },
      { texto: "Guardar", clase: "primary", onClick: async (dlg) => {
        const n = Number(input.value);
        if (!(n > 0)) { toast("Pon un número mayor que 0", "error"); return; }
        try {
          await actualizarTemporada(ctx.temporadaId, { rutaMinimo: n });
          dlg.close(); toast("Mínimo actualizado"); render(root, ctx);
        } catch (e) { toast("Error: " + e.message, "error"); }
      } },
    ]);
  }

  const cont = el("div", {});
  root.append(cont);
  cont.append(el("div", { class: "panel" }, el("div", { class: "muted" }, "Cargando…")));

  const inscritos = await listar(ctx.temporadaId, "inscripciones");
  const contactos = await listar(ctx.temporadaId, "contactos");

  // Confirmados = inscritos con ruta. Interesados = contactos con ruta que aún no están inscritos.
  const confirmados = inscritos.filter((d) => d.ruta).map((d) => ({ ...d, _tipo: "Confirmado", _col: "inscripciones" }));
  const interesados = contactos.filter((d) => d.ruta).map((d) => ({ ...d, _tipo: "Interesado", _col: "contactos" }));

  const nConf = confirmados.length;
  const nInt = interesados.length;
  const nTotal = nConf + nInt;          // potencial total (interesados + confirmados)
  const viableConf = nConf >= RUTA_MIN;
  const viableTotal = nTotal >= RUTA_MIN;
  const faltanConf = Math.max(0, RUTA_MIN - nConf);
  const faltanTotal = Math.max(0, RUTA_MIN - nTotal);

  cont.innerHTML = "";

  // Tarjetas de resumen.
  cont.append(el("div", { class: "cards-row" },
    tarjeta("Confirmados (inscritos)", nConf, viableConf ? "ok" : ""),
    tarjeta("Interesados (contactos)", nInt),
    tarjeta("Potencial total", `${nTotal} / ${RUTA_MIN}`, viableTotal ? "ok" : "warn"),
  ));

  // Semáforo principal: basado en confirmados (los que ya cuentan de verdad).
  const semaforo = el("div", { class: "panel ruta-status " + (viableConf ? "ok" : "warn") },
    el("div", { class: "ruta-big" }, viableConf ? "✅" : "⏳"),
    el("div", {},
      el("div", { class: "stat-val" }, `${nConf} / ${RUTA_MIN} confirmados`),
      el("div", { class: "stat-lbl" }, viableConf
        ? "¡Ruta viable! Ya hay confirmados suficientes."
        : `Faltan ${faltanConf} confirmado(s) para activar la ruta.`),
    ),
  );
  cont.append(semaforo);

  // Aviso: si sumando interesados se alcanza el mínimo, sugerir contratar/gestionar.
  if (!viableConf && viableTotal) {
    cont.append(el("div", { class: "panel ruta-status ok" },
      el("div", { class: "ruta-big" }, "📣"),
      el("div", {}, el("div", { class: "stat-lbl" },
        `¡Atención! Con los ${nInt} interesado(s) ya se alcanzaría el mínimo de ${RUTA_MIN}. ` +
        "Vale la pena gestionar la ruta y confirmar a los interesados.")),
    ));
  } else if (!viableTotal) {
    cont.append(el("div", { class: "panel muted small" },
      `Sumando interesados y confirmados faltarían ${faltanTotal} estudiante(s) para el mínimo de ${RUTA_MIN}.`));
  }

  cont.append(tablaPersonas("✅ Confirmados (inscritos con ruta)", confirmados,
    "Marca “Necesita ruta” en Inscripciones para sumar aquí.", ctx, root));
  cont.append(tablaPersonas("⏳ Interesados (contactos con ruta)", interesados,
    "Marca “Requiere ruta” en Contactos para sumar aquí.", ctx, root));
}

function tarjeta(lbl, val, tono = "") {
  return el("div", { class: "stat " + tono }, el("div", { class: "stat-val" }, String(val)), el("div", { class: "stat-lbl" }, lbl));
}

function tablaPersonas(titulo, lista, ayuda, ctx, root) {
  const panel = el("div", { class: "panel" });
  panel.append(el("div", { class: "panel-head" }, el("h3", {}, titulo),
    el("div", { class: "muted small" }, ayuda)));
  if (!lista.length) { panel.append(el("div", { class: "empty" }, "Nadie por ahora.")); return panel; }
  const tb = el("tbody", {});
  lista.forEach((d) => tb.append(el("tr", {},
    el("td", {}, el("strong", {}, d.estudiante || "—")),
    el("td", {}, d.celular || ""),
    el("td", {}, d.direccion || el("span", { class: "muted" }, "sin dirección")),
    el("td", { class: "row-actions" },
      el("button", { class: "btn ghost small", onclick: async () => {
        const dir = prompt("Dirección / barrio para la ruta:", d.direccion || "");
        if (dir === null) return;
        await actualizar(ctx.temporadaId, d._col, d.id, { direccion: dir.trim() });
        toast("Dirección guardada"); render(root, ctx);
      } }, "Dirección"),
    ),
  )));
  panel.append(el("div", { class: "table-wrap" }, el("table", { class: "table" },
    el("thead", {}, el("tr", {}, ...["Estudiante", "Celular", "Dirección", ""].map((h) => el("th", {}, h)))), tb)));
  return panel;
}
