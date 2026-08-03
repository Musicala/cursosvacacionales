// Cálculos compartidos del libro de pagos.
export function totalPagos(inscripcion) {
  return (inscripcion.pagos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
}

export function totalPagado(inscripcion) {
  const movimientos = totalPagos(inscripcion);
  // Compatibilidad: un registro antiguo marcado Pagado, sin movimientos, ya fue cancelado.
  if (!movimientos && inscripcion.estadoPago === "Pagado") {
    return Number(inscripcion.valor) || 0;
  }
  return movimientos;
}

export function saldoInscripcion(inscripcion) {
  return Math.max(0, (Number(inscripcion.valor) || 0) - totalPagado(inscripcion));
}

export function estadoPagoCalculado(inscripcion) {
  const valor = Number(inscripcion.valor) || 0;
  const pagado = totalPagado(inscripcion);
  if (valor > 0 && pagado >= valor) return "Pagado";
  if (pagado > 0) return "Abono";
  return "Pendiente";
}

// Cuántos días de clase tiene cada semana marcada de una inscripción.
// Si la inscripción no guardó días (registros viejos), devuelve {} y quien
// llame reparte en partes iguales como antes.
export function diasPorSemanaDe(inscripcion) {
  const mapa = (inscripcion && inscripcion.diasPorSemana) || {};
  const res = {};
  (inscripcion.semanas || []).forEach((semana) => {
    const dias = mapa[semana];
    if (Array.isArray(dias)) res[semana] = dias.length;
  });
  return res;
}

// Reparte el valor total entre las semanas **según los días de cada una**.
// Antes se dividía en partes iguales, así que quien tomaba 2 días en una
// semana y 2 en otra veía dos semanas completas pendientes.
export function valoresPorSemana(inscripcion) {
  const semanas = inscripcion.semanas || [];
  const total = Number(inscripcion.valor) || 0;
  if (!semanas.length) return {};

  const dias = diasPorSemanaDe(inscripcion);
  const pesos = semanas.map((s) => Number(dias[s]) || 0);
  const sumaDias = pesos.reduce((a, b) => a + b, 0);
  // Sin días registrados: se mantiene el reparto en partes iguales.
  const finales = sumaDias > 0 ? pesos : semanas.map(() => 1);
  const suma = sumaDias > 0 ? sumaDias : semanas.length;

  const valores = finales.map((peso) => Math.floor((total * peso) / suma));
  // Los pesos sueltos del redondeo van a la última semana que sí tiene días.
  const ultimaConDias = finales.reduce((idx, peso, i) => (peso > 0 ? i : idx), -1);
  if (ultimaConDias >= 0) {
    valores[ultimaConDias] += total - valores.reduce((a, b) => a + b, 0);
  }
  return Object.fromEntries(semanas.map((semana, i) => [semana, valores[i]]));
}

export function pagosPorSemana(inscripcion) {
  const resultado = {};
  (inscripcion.pagos || []).forEach((p) => {
    Object.entries(p.distribucion || {}).forEach(([semana, valor]) => {
      resultado[semana] = (resultado[semana] || 0) + (Number(valor) || 0);
    });
  });
  return resultado;
}
