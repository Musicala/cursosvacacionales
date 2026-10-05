const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

// Configurar una sola vez con: firebase functions:secrets:set WIX_API_KEY
// La clave jamás se incluye en Hosting ni se devuelve al navegador.
const wixApiKey = defineSecret("WIX_API_KEY");
const WIX_SITE_ID = "1c8e0ead-65dd-4028-aad4-eaa3dda243c0";
const WIX_SERVICES_QUERY_URL = "https://www.wixapis.com/_api/bookings/v2/services/query";
const TIME_ZONE = "America/Bogota";
const ALLOWED_ORIGINS = [/^https:\/\/musicala\.github\.io$/, /^http:\/\/(127\.0\.0\.1|localhost)(?::\d+)?$/];
const COORDINACION = new Set([
  "alekcaballeromusic@gmail.com",
  "catalina.medina.leal@gmail.com",
  "adminmusicala@gmail.com",
  "musicalaasesor@gmail.com",
]);

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

// Secret Manager conserva exactamente el valor introducido. Al eliminar espacios
// accidentales evitamos que un salto de línea convierta el encabezado HTTP en inválido.
function wixHeaders(includeContentType = false) {
  const headers = {
    Authorization: wixApiKey.value().trim(),
    "wix-site-id": WIX_SITE_ID,
  };
  if (includeContentType) headers["Content-Type"] = "application/json";
  return headers;
}

async function wixRequestError(label, response) {
  const detail = await response.text();
  // No registramos encabezados ni secretos; el estado y la respuesta de Wix bastan para diagnosticar.
  logger.error(label, {
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    detail: detail.slice(0, 500),
  });
}

async function requireCoordinator(req) {
  const header = req.get("authorization") || "";
  if (!header.startsWith("Bearer ")) throw new Error("UNAUTHENTICATED");
  const token = await admin.auth().verifyIdToken(header.slice(7));
  if (!COORDINACION.has((token.email || "").toLowerCase())) throw new Error("FORBIDDEN");
  return token;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "");
}

function inferredWorkshopId(group) {
  if (group.workshopId) return group.workshopId;
  const text = `${group.area || ""} ${group.taller || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (text.includes("musica")) return "musica";
  if (text.includes("ludica") || text.includes("ludico")) return "ludico";
  if (text.includes("arte")) return "arte";
  if (text.includes("corporal") || text.includes("expresion")) return "corporal";
  return "";
}

function safeSlot(slot) {
  const info = slot.eventInfo || {};
  return {
    serviceId: slot.serviceId || "",
    eventId: info.eventId || slot.eventId || "",
    eventTitle: info.eventTitle || slot.eventTitle || "",
    localStartDate: slot.localStartDate || "",
    localEndDate: slot.localEndDate || "",
    bookable: Boolean(slot.bookable),
    remainingCapacity: Number.isFinite(slot.remainingCapacity) ? slot.remainingCapacity : null,
    bookableCapacity: Number.isFinite(slot.bookableCapacity) ? slot.bookableCapacity : null,
    scheduleId: slot.scheduleId || info.scheduleId || "",
  };
}

async function listEventTimeSlots(serviceIds, from, to) {
  let cursor = null;
  const slots = [];
  do {
    const body = {
      fromLocalDate: from + "T00:00:00",
      toLocalDate: to + "T23:59:59",
      timeZone: TIME_ZONE,
      serviceIds,
      includeNonBookable: true,
      cursorPaging: { limit: 100, ...(cursor ? { cursor } : {}) },
    };
    const response = await fetch("https://www.wixapis.com/_api/service-availability/v2/time-slots/event", {
      method: "POST",
      headers: wixHeaders(true),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      await wixRequestError("Wix Time Slots request failed", response);
      throw new Error("WIX_REQUEST_FAILED");
    }
    const data = await response.json();
    slots.push(...(data.timeSlots || []).map(safeSlot));
    cursor = data.pagingMetadata?.cursor || data.cursorPagingMetadata?.cursor || null;
  } while (cursor);
  return slots;
}

async function getService(serviceId) {
  const url = `https://www.wixapis.com/_api/bookings/v2/services/${encodeURIComponent(serviceId)}`;
  const response = await fetch(url, {
    headers: wixHeaders(),
  });
  if (!response.ok) {
    await wixRequestError("Wix Get Service failed", response);
    logger.warn("Wix Get Service trace", { url, siteId: WIX_SITE_ID, serviceId, status: response.status });
    return { id: serviceId, found: false, status: response.status };
  }
  const data = await response.json();
  const service = data.service || {};
  logger.info("Wix Get Service trace", { url, siteId: WIX_SITE_ID, status: response.status, responseKeys: Object.keys(data), service: { id: service.id || "", name: service.name || "", type: service.type || "" } });
  return {
    id: serviceId,
    found: true,
    name: service.name || "",
    type: service.type || "",
    onlineBookingEnabled: service.onlineBooking?.enabled ?? null,
    hidden: service.hidden ?? null,
  };
}

async function listClassServices() {
  const limit = 100;
  let offset = 0;
  let total = Infinity;
  const services = [];
  while (offset < total) {
    const requestBody = { query: { filter: { type: { $eq: "CLASS" } }, paging: { limit, offset } } };
    const response = await fetch(WIX_SERVICES_QUERY_URL, {
      method: "POST",
      headers: wixHeaders(true),
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      await wixRequestError("Wix Services query failed", response);
      logger.error("Wix Services query trace", { url: WIX_SERVICES_QUERY_URL, siteId: WIX_SITE_ID, status: response.status, requestBody });
      throw new Error("WIX_SERVICES_REQUEST_FAILED");
    }
    const data = await response.json();
    const page = data.services || [];
    logger.info("Wix Services query trace", { url: WIX_SERVICES_QUERY_URL, siteId: WIX_SITE_ID, status: response.status, responseKeys: Object.keys(data), wrapperDataKeys: data.data && typeof data.data === "object" ? Object.keys(data.data) : [], servicesReceived: page.length, received: page.map((service) => ({ id: service.id || "", name: service.name || "", type: service.type || "" })) });
    services.push(...page);
    const paging = data.pagingMetadata || {};
    total = Number.isFinite(paging.total) ? paging.total : offset + page.length;
    if (!page.length || page.length < limit) break;
    offset += page.length;
  }
  const classServices = services.filter((s) => s.type === "CLASS");
  const expectedIds = ["9d77dd01-50c9-4955-9fde-a8c8330c4a3d", "601068d4-a42f-404d-ae59-8c1d23b84de3", "deaf3557-1318-4d61-8fe4-f5be32692ecb", "8a015cbc-bf41-44ab-b955-d82ef4407cc4"];
  logger.info("Wix Services normalized trace", { servicesBeforeClassFilter: services.length, classServices: classServices.length, expectedIds: expectedIds.map((id) => ({ id, found: classServices.some((service) => service.id === id) })) });
  return classServices.map((s) => ({
    id: s.id,
    name: s.name || "",
    type: s.type,
    hidden: Boolean(s.hidden),
    onlineBookingEnabled: s.onlineBooking?.enabled ?? null,
  })).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

exports.wixServices = onRequest({ region: "us-central1", cors: ALLOWED_ORIGINS, secrets: [wixApiKey] }, async (req, res) => {
  if (req.method !== "GET") return sendError(res, 405, "Método no permitido.");
  try {
    await requireCoordinator(req);
    const serviceId = String(req.query.serviceId || "").trim();
    if (serviceId) {
      const service = await getService(serviceId);
      return res.json({ ok: true, services: service.found && service.type === "CLASS" ? [{ id: service.id, name: service.name, type: service.type, hidden: service.hidden, onlineBooking: service.onlineBookingEnabled }] : [], checkedService: service });
    }
    return res.json({ ok: true, services: await listClassServices() });
  } catch (error) {
    if (error.message === "UNAUTHENTICATED") return sendError(res, 401, "Inicia sesión para consultar Wix.");
    if (error.message === "FORBIDDEN") return sendError(res, 403, "No tienes permiso para consultar Wix.");
    logger.error("Error listando servicios Wix", error);
    return sendError(res, 502, "No se pudieron consultar los servicios de Wix.");
  }
});

// Solo lectura. La fase de reservas se añadirá en otro endpoint y no comparte mutaciones.
exports.wixSessions = onRequest({ region: "us-central1", cors: ALLOWED_ORIGINS, secrets: [wixApiKey] }, async (req, res) => {
  if (req.method !== "GET") return sendError(res, 405, "Método no permitido.");
  try {
    await requireCoordinator(req);
    const temporadaId = String(req.query.temporadaId || "");
    const semana = String(req.query.semana || "");
    if (!temporadaId || !semana) return sendError(res, 400, "temporadaId y semana son obligatorios.");

    const db = admin.firestore();
    const [temporadaSnap, talleresSnap, gruposSnap] = await Promise.all([
      db.doc(`temporadas/${temporadaId}`).get(),
      db.collection("vacationWorkshops").get(),
      db.collection(`temporadas/${temporadaId}/grupos`).where("semana", "==", semana).get(),
    ]);
    if (!temporadaSnap.exists) return sendError(res, 404, "La temporada no existe.");
    const temporada = temporadaSnap.data();
    const index = (temporada.semanasFechas || []).findIndex((_, i) => `Semana ${i + 1}` === semana);
    const fechas = index >= 0 ? temporada.semanasFechas[index] || {} : {};
    if (!isIsoDate(fechas.desde) || !isIsoDate(fechas.hasta)) {
      return sendError(res, 400, "La semana seleccionada debe tener fecha inicial y final configuradas.");
    }

    const workshops = talleresSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).filter((w) => w.active !== false);
    const byId = new Map(workshops.map((w) => [w.id, w]));
    const requestedWorkshopIds = [...new Set(gruposSnap.docs.map((doc) => inferredWorkshopId(doc.data())).filter(Boolean))];
    const serviceIds = requestedWorkshopIds.map((id) => byId.get(id)?.wixServiceId).filter(Boolean);
    const uniqueServiceIds = [...new Set(serviceIds)];
    const services = await Promise.all(uniqueServiceIds.map(getService));
    const validClassIds = services.filter((s) => s.found && s.type === "CLASS").map((s) => s.id);
    const slots = validClassIds.length ? await listEventTimeSlots(validClassIds, fechas.desde, fechas.hasta) : [];
    const issues = services.flatMap((service) => {
      if (!service.found) return [{ type: "SERVICE_NOT_FOUND", serviceId: service.id, message: "El Service ID no existe o Wix no permitió consultarlo." }];
      if (service.type !== "CLASS") return [{ type: "SERVICE_NOT_CLASS", serviceId: service.id, message: `El servicio es ${service.type || "de tipo desconocido"}, no CLASS.` }];
      return [];
    });

    return res.json({
      ok: true,
      temporadaId,
      semana,
      week: { startDate: fechas.desde, endDate: fechas.hasta, timeZone: TIME_ZONE },
      from: fechas.desde,
      to: fechas.hasta,
      workshops: workshops.map(({ id, name, wixServiceId, active }) => ({ id, name, wixServiceId, active })),
      services,
      scheduled: gruposSnap.docs.map((doc) => {
        const g = doc.data();
        return { id: doc.id, dia: g.dia || "", workshopId: inferredWorkshopId(g), area: g.area || "", taller: g.taller || "" };
      }),
      slots,
      sessions: slots.map((slot) => ({ ...slot, date: slot.localStartDate.slice(0, 10), startTime: slot.localStartDate.slice(11, 16), endTime: slot.localEndDate.slice(11, 16) })),
      issues,
    });
  } catch (error) {
    if (error.message === "UNAUTHENTICATED") return sendError(res, 401, "Inicia sesión para verificar Wix.");
    if (error.message === "FORBIDDEN") return sendError(res, 403, "No tienes permiso para verificar Wix.");
    logger.error("Error verificando sesiones Wix", error);
    return sendError(res, 502, "No se pudo consultar Wix. Revisa el secreto, permisos y configuración.");
  }
});
