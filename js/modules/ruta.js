// Módulo Ruta: lista de quienes necesitan ruta y viabilidad vs. el mínimo.
import { el, toast } from "../ui.js";
import { listar, actualizar } from "../db.js";
import { RUTA_MINIMO } from "../catalogos.js";

export default async function render(root, ctx) {
  root.append(el("div", { class: "panel-head" }, el("h2", {}, "🚌 Ruta")));

  const cont = el("div", {});
  root.append(cont);
  cont.append(el("div", { class: "panel" }, el("div", { class: "muted" }, "Cargando…")));

  const inscritos = await listar(ctx.temporadaId, "inscripciones");
  const contactos = await listar(ctx.temporadaId, "contactos");
  const conRuta = [
    ...inscritos.filter((d) => d.ruta).map((d) => ({ ...d, _tipo: "Inscrito", _col: "inscripciones" })),
    ...contactos.filter((d) => d.ruta).map((d) => ({ ...d, _tipo: "Contacto", _col: "contactos" })),
  ];
  const n = conRuta.length;
  const viable = n >= RUTA_MINIMO;
  const faltan = Math.max(0, RUTA_MINIMO - n);

  cont.innerHTML = "";
  const semaforo = el("div", { class: "panel ruta-status " + (viable ? "ok" : "warn") },
    el("div", { class: "ruta-big" }, viable ? "✅" : "⏳"),
    el("div", {},
      el("div", { class: "stat-val" }, `${n} / ${RUTA_MINIMO}`),
      el("div", { class: "stat-lbl" }, viable
        ? "¡Ruta viable! Ya se alcanzó el mínimo."
        : `Faltan ${faltan} estudiante(s) para activar la ruta.`),
    ),
  );
  cont.append(semaforo);

  const panel = el("div", { class: "panel" });
  panel.append(el("div", { class: "panel-head" }, el("h3", {}, "Estudiantes que piden ruta"),
    el("div", { class: "muted small" }, "Marca el check de “ruta” en Contactos o Inscripciones para sumar aquí.")));
  if (!n) panel.append(el("div", { class: "empty" }, "Nadie ha solicitado ruta todavía."));
  else {
    const tb = el("tbody", {});
    conRuta.forEach((d) => tb.append(el("tr", {},
      el("td", {}, el("strong", {}, d.estudiante || "—")),
      el("td", {}, d._tipo),
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
      el("thead", {}, el("tr", {}, ...["Estudiante", "Tipo", "Celular", "Dirección", ""].map((h) => el("th", {}, h)))), tb)));
  }
  cont.append(panel);
}
