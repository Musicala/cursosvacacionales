// Migraciones de datos que corren una sola vez (las ejecuta coordinación al entrar).
// Cada migración deja una marca en config/global para no repetirse.
import { listar, actualizar, leerConfig, guardarConfig } from "./db.js?v=5";
import { nombreGrupo } from "./catalogos.js?v=5";

// Renombra el campo "grupo" guardado con los nombres viejos
// (Musicalitos, Musikids, Musiteens) al nombre actual con edades,
// en todas las temporadas y en las colecciones que lo usan.
export async function migrarNombresGrupos(temporadas) {
  const cfg = await leerConfig();
  if (cfg && cfg.migracionNombresGrupos) return 0;

  let cambiados = 0;
  for (const t of temporadas) {
    for (const sub of ["grupos", "inscripciones", "contactos"]) {
      const docs = await listar(t.id, sub);
      for (const d of docs) {
        const nuevo = nombreGrupo(d.grupo);
        if (d.grupo && nuevo !== d.grupo) {
          await actualizar(t.id, sub, d.id, { grupo: nuevo });
          cambiados++;
        }
      }
    }
  }

  await guardarConfig({ migracionNombresGrupos: true });
  return cambiados;
}
