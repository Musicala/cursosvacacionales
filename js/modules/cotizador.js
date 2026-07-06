// Módulo Cotizador: simula el valor de un plan con descuentos, SIN guardar nada.
// Sirve para responder rápido "¿cuánto queda con descuentos?" a quien pregunta,
// con desglose por estudiante. Reutiliza la misma lógica de precios que Inscripciones.
import { el, cop, toast } from "../ui.js?v=4";
import { obtenerTemporada } from "../db.js?v=5";
import { semanasDetalle } from "../catalogos.js?v=4";
import { calcularPrecio } from "./inscripciones.js?v=7";

// Descuentos que el cotizador aplica AUTOMÁTICAMENTE (no como checkbox manual):
//  - "Hermano": solo del 2º estudiante en adelante.
//  - "Más de una semana": si el estudiante toma 2+ semanas.
const esHermano = (d) => /herman/i.test(d.nombre || "");
const esMultiSemana = (d) => /(m[aá]s de una semana|multi.?semana|semana completa|varias semanas)/i.test(d.nombre || "");

// Busca en la lista un descuento por criterio; devuelve su % (o el valor por defecto).
function pct(lista, criterio, defecto) {
  const d = (lista || []).find(criterio);
  if (!d) return defecto;
  return d.tipo === "valor" ? { tipo: "valor", valor: Number(d.valor) || 0 } : { tipo: "porcentaje", valor: Number(d.valor) || 0 };
}

function aplicar(base, desc) {
  if (!desc) return 0;
  return desc.tipo === "valor" ? Math.min(base, desc.valor) : Math.round(base * (desc.valor / 100));
}

export default async function render(root, ctx) {
  const t = (await obtenerTemporada(ctx.temporadaId)) || ctx.temporada || { id: ctx.temporadaId };
  const detalle = semanasDetalle(t);
  const precios = Array.isArray(t.precios) ? t.precios : [];
  const descuentosLista = Array.isArray(t.descuentosLista) ? t.descuentosLista : [];

  const hayPrecios = precios.some((p) => Number(p.valor) > 0);

  root.append(el("div", { class: "panel-head" },
    el("h2", {}, "🧮 Cotizador rápido"),
    el("div", { class: "right" },
      el("button", { class: "btn ghost", onclick: () => ctx.irA("temporada") }, "Ver precios y descuentos")),
  ));

  if (!hayPrecios) {
    root.append(el("div", { class: "panel" },
      el("div", { class: "empty" }, "Esta temporada aún no tiene precios definidos. Ve a Info temporada → Editar info para agregarlos.")));
    return;
  }

  // Descuentos automáticos (se aplican solos según semanas / orden de hermano).
  const descHermano = pct(descuentosLista, esHermano, { tipo: "porcentaje", valor: 20 });
  const descMulti = pct(descuentosLista, esMultiSemana, { tipo: "porcentaje", valor: 5 });

  // Descuentos manuales: el resto de la lista (ej: Referido, Pago anticipado).
  const manuales = descuentosLista.filter((d) => !esHermano(d) && !esMultiSemana(d) && (Number(d.valor) > 0 || d.tipo === "valor"));

  // Días efectivos de una semana (si no está configurada, se asume 5).
  const diasSemana = (s) => Number(s.dias) || 5;

  // ----- Estado del formulario -----
  const estado = {
    numEstudiantes: 1,
    semanasEst: [new Set(detalle.length ? [detalle[0].nombre] : [])], // qué semanas toma cada estudiante
    hermano: true,                    // aplicar descuento de hermano (2º en adelante)
    multiSemana: true,                // aplicar 5% por más de una semana
    manuales: new Set(),              // nombres de descuentos manuales activos
  };

  const panel = el("div", { class: "panel" });
  const controles = el("div", { class: "cotz-controles" });
  const resultado = el("div", { class: "cotz-resultado" });
  panel.append(controles, resultado);
  root.append(panel);

  // --- Controles ---
  function pintarControles() {
    controles.innerHTML = "";

    // Número de estudiantes
    const nEst = el("input", { type: "number", min: "1", max: "10", value: String(estado.numEstudiantes) });
    nEst.oninput = () => {
      const n = Math.max(1, Math.min(10, Number(nEst.value) || 1));
      estado.numEstudiantes = n;
      // Al agregar estudiantes, copia las semanas del último (suele ser el mismo caso).
      while (estado.semanasEst.length < n) {
        const prev = estado.semanasEst[estado.semanasEst.length - 1];
        estado.semanasEst.push(new Set(prev || []));
      }
      estado.semanasEst = estado.semanasEst.slice(0, n);
      pintarControles();
      recalcular();
    };

    controles.append(el("div", { class: "form-grid" },
      el("label", {}, "Cuántos estudiantes (hermanos)", nEst)));

    // Semanas por estudiante: casillas de cada semana real (con sus días).
    const filas = el("div", { class: "cotz-est-list" });
    for (let i = 0; i < estado.numEstudiantes; i++) {
      const sel = estado.semanasEst[i];
      const casillas = el("div", { class: "checks cotz-semanas" });
      detalle.forEach((s) => {
        const c = el("input", { type: "checkbox" });
        c.checked = sel.has(s.nombre);
        c.onchange = () => { c.checked ? sel.add(s.nombre) : sel.delete(s.nombre); recalcular(); };
        casillas.append(el("label", { class: "check" }, c, ` ${s.nombre} (${diasSemana(s)} días)`));
      });
      filas.append(el("div", { class: "cotz-est-row" },
        el("span", { class: "sem-label" }, `Estudiante ${i + 1}`), casillas));
    }
    controles.append(el("h4", {}, "🗓️ Semanas por estudiante"), filas);

    // Descuentos
    const chks = el("div", { class: "checks" });

    if (estado.numEstudiantes >= 2) {
      const c = el("input", { type: "checkbox" }); c.checked = estado.hermano;
      c.onchange = () => { estado.hermano = c.checked; recalcular(); };
      chks.append(el("label", { class: "check" }, c, ` Hermano (${valorTexto(descHermano)}) — del 2º en adelante`));
    }

    const cm = el("input", { type: "checkbox" }); cm.checked = estado.multiSemana;
    cm.onchange = () => { estado.multiSemana = cm.checked; recalcular(); };
    chks.append(el("label", { class: "check" }, cm, ` Más de una semana (${valorTexto(descMulti)}) — automático si toma 2+`));

    manuales.forEach((d) => {
      const c = el("input", { type: "checkbox" }); c.checked = estado.manuales.has(d.nombre);
      c.onchange = () => { c.checked ? estado.manuales.add(d.nombre) : estado.manuales.delete(d.nombre); recalcular(); };
      chks.append(el("label", { class: "check" }, c, ` ${d.nombre} (${valorTexto(d)})`));
    });

    controles.append(el("h4", {}, "🏷️ Descuentos"), chks);
  }

  function valorTexto(d) {
    return d.tipo === "valor" ? cop(d.valor) : `${Number(d.valor) || 0}%`;
  }

  // --- Cálculo + desglose ---
  function recalcular() {
    resultado.innerHTML = "";
    let totalFamilia = 0;
    let totalDescuentos = 0;
    let totalBase = 0;

    const bloques = el("div", { class: "cotz-desglose" });

    for (let i = 0; i < estado.numEstudiantes; i++) {
      // Semanas elegidas, en el orden en que aparecen en la temporada.
      const sel = estado.semanasEst[i];
      const semanasSel = detalle.filter((s) => sel.has(s.nombre));
      const nSem = semanasSel.length;

      // Precio base de CADA semana por separado (para poder desglosarlo).
      const semInfo = semanasSel.map((s) => {
        const r = calcularPrecio({ semanas: [s.nombre], detalleSemanas: detalle, precios, descuentosLista: [], descuentoIds: [] });
        return { nombre: s.nombre, dias: diasSemana(s), base: r.valorBase };
      });
      const valorBase = semInfo.reduce((a, s) => a + s.base, 0);
      const totalDias = semInfo.reduce((a, s) => a + s.dias, 0);
      const horas = totalDias * 4;

      // Descuentos que aplican a este estudiante. NO se acumulan: se aplica
      // solo el mayor. (Ej: si tiene hermano 20% y multi-semana 5%, gana el 20%.)
      const candidatos = [];
      if (estado.multiSemana && nSem >= 2) {
        candidatos.push(["Más de una semana", aplicar(valorBase, descMulti)]);
      }
      if (estado.hermano && estado.numEstudiantes >= 2 && i >= 1) {
        candidatos.push(["Hermano", aplicar(valorBase, descHermano)]);
      }
      manuales.forEach((d) => {
        if (estado.manuales.has(d.nombre)) candidatos.push([d.nombre, aplicar(valorBase, d)]);
      });

      const lineas = [];
      let descEst = 0;
      const mejor = candidatos.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0];
      if (mejor) { descEst = mejor[1]; lineas.push(mejor); }

      const subtotal = Math.max(0, valorBase - descEst);
      totalBase += valorBase;
      totalDescuentos += descEst;
      totalFamilia += subtotal;

      // Reparte el subtotal (ya con descuento) entre las semanas, proporcional a su precio.
      // Así se puede decir "la semana de $392.000 quedó en $X con descuento".
      let repartido = 0;
      semInfo.forEach((s, j) => {
        s.conDesc = (j === semInfo.length - 1)
          ? subtotal - repartido
          : (valorBase ? Math.round(subtotal * (s.base / valorBase)) : 0);
        repartido += s.conDesc;
      });

      const detalleSem = nSem ? `${semanasSel.map((s) => s.nombre).join(", ")} · ${totalDias} días` : "sin semanas seleccionadas";

      const filas = el("div", { class: "cotz-lineas" });
      if (nSem) {
        semInfo.forEach((s) => filas.append(fila(`${s.nombre} (${s.dias} días)`, cop(s.base))));
        lineas.forEach(([nombre, v]) => filas.append(fila("− " + nombre, "−" + cop(v), "desc")));
        filas.append(fila("Subtotal estudiante", cop(subtotal), "sub"));
        // Con descuento aplicado, cuánto quedó cada semana (respuesta típica del cliente).
        if (descEst && nSem >= 2) {
          filas.append(el("div", { class: "muted small cotz-unitario" },
            "Con descuento: " + semInfo.map((s) => `${s.nombre} ${cop(s.conDesc)}`).join(" · ")));
        }
        const porDia = totalDias ? Math.round(subtotal / totalDias) : 0;
        const porHora = horas ? Math.round(subtotal / horas) : 0;
        filas.append(el("div", { class: "muted small cotz-unitario" },
          `≈ ${cop(porDia)} por día · ${cop(porHora)} por hora`));
      } else {
        filas.append(el("div", { class: "muted small" }, "Marca al menos una semana."));
      }

      bloques.append(el("div", { class: "cotz-est-card" },
        el("h4", {}, `Estudiante ${i + 1}`),
        el("div", { class: "muted small cotz-est-sub" }, detalleSem),
        filas));
    }

    resultado.append(bloques);
    resultado.append(el("div", { class: "cotz-total" },
      el("div", { class: "cotz-total-linea" }, el("span", {}, "Precio sin descuentos"), el("strong", {}, cop(totalBase))),
      totalDescuentos ? el("div", { class: "cotz-total-linea desc" }, el("span", {}, "Total descuentos"), el("strong", {}, "−" + cop(totalDescuentos))) : null,
      el("div", { class: "cotz-total-linea grande" }, el("span", {}, "TOTAL a pagar"), el("strong", {}, cop(totalFamilia))),
    ));

    const copiar = el("button", { class: "btn ghost small", onclick: () => copiarResumen(totalBase, totalDescuentos, totalFamilia) }, "📋 Copiar resumen");
    resultado.append(el("div", { class: "right", style: "margin-top:12px" }, copiar));
  }

  function copiarResumen(base, desc, total) {
    const lineas = [];
    for (let i = 0; i < estado.numEstudiantes; i++) {
      const semanas = detalle.filter((s) => estado.semanasEst[i].has(s.nombre)).map((s) => s.nombre);
      lineas.push(`Estudiante ${i + 1}: ${semanas.length ? semanas.join(", ") : "sin semanas"}`);
    }
    const txt = [
      "Cotización cursos vacacionales Musicala",
      ...lineas,
      desc ? `Precio sin descuentos: ${cop(base)}` : null,
      desc ? `Descuentos: −${cop(desc)}` : null,
      `TOTAL: ${cop(total)}`,
    ].filter(Boolean).join("\n");
    navigator.clipboard?.writeText(txt).then(() => toast("Resumen copiado"), () => toast("No se pudo copiar", "error"));
  }

  function fila(lbl, val, clase) {
    return el("div", { class: "cotz-linea" + (clase ? " " + clase : "") },
      el("span", {}, lbl), el("span", {}, val));
  }

  pintarControles();
  recalcular();
}
