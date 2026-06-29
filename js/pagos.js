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

export function valoresPorSemana(inscripcion) {
  const semanas = inscripcion.semanas || [];
  const total = Number(inscripcion.valor) || 0;
  if (!semanas.length) return {};
  const base = Math.floor(total / semanas.length);
  let restante = total;
  return Object.fromEntries(semanas.map((semana, i) => {
    const valor = i === semanas.length - 1 ? restante : base;
    restante -= valor;
    return [semana, valor];
  }));
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
