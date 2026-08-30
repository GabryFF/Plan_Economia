import { obtenerBD } from '../db/conexion.js';

/**
 * Preferencias del usuario. Se guardan como pares clave/valor: son un puñado de
 * campos numéricos y no merecen una tabla con columnas propias.
 */

export const AJUSTES_POR_DEFECTO = {
  // Porcentaje de los ingresos que se quiere ahorrar cada mes.
  // 20 % es el tramo de ahorro de la regla 50/30/20, la referencia más extendida.
  objetivoAhorro: 20,
  // Meses de gastos que debería cubrir el colchón de imprevistos.
  mesesFondoEmergencia: 6,
  // Lo que ya se tiene apartado para imprevistos. La aplicación no puede saberlo:
  // no lee cuentas bancarias, así que lo introduce el usuario.
  colchonActual: 0,
  // Nóminas al año. En España lo habitual es 12 o 14 (dos pagas extra).
  // Cambia por completo cómo hay que leer los ingresos: ver `medianaIngresosMensuales`.
  pagasAlAnio: 12,
  // Modo autónomo: activa la sección de gestión fiscal.
  modoAutonomo: 0,
  // El asistente de primer arranque ya se ha visto (o se ha omitido).
  asistenteCompletado: 0,
  // La cuota la introduce el usuario: se la cobran cada mes y la conoce exacta.
  autonomoCuota: 0,
  autonomoTipoIva: 21,
  autonomoTipoIrpf: 15,
};

const NUMERICOS = {
  objetivoAhorro: { min: 0, max: 90 },
  mesesFondoEmergencia: { min: 1, max: 24 },
  colchonActual: { min: 0, max: 99_999_999 },
  pagasAlAnio: { min: 12, max: 16 },
  modoAutonomo: { min: 0, max: 1 },
  asistenteCompletado: { min: 0, max: 1 },
  autonomoCuota: { min: 0, max: 5000 },
  autonomoTipoIva: { min: 0, max: 21 },
  autonomoTipoIrpf: { min: 0, max: 47 },
};

export function obtenerAjustes() {
  const filas = obtenerBD().prepare('SELECT clave, valor FROM ajustes').all();
  const guardados = Object.fromEntries(filas.map((f) => [f.clave, Number(f.valor)]));

  return { ...AJUSTES_POR_DEFECTO, ...guardados };
}

export function guardarAjustes(cambios) {
  const bd = obtenerBD();
  const sentencia = bd.prepare(
    'INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor'
  );

  for (const [clave, valor] of Object.entries(cambios)) {
    if (valor === undefined) continue;

    if (!(clave in NUMERICOS)) continue;

    const { min, max } = NUMERICOS[clave];
    const acotado = Math.min(Math.max(Number(valor), min), max);
    sentencia.run(clave, String(acotado));
  }

  return obtenerAjustes();
}

