import { useEffect } from 'react';

/**
 * Aviso de "los ajustes han cambiado".
 *
 * La barra lateral decide qué secciones enseña a partir de los ajustes, y los
 * pide una sola vez al arrancar. Cuando otra pantalla los cambia —el asistente
 * activando el modo autónomo, por ejemplo— la barra no se entera y la sección
 * nueva no aparece hasta recargar la página a mano, que es justo lo que no se
 * le puede pedir a quien no toca un ordenador.
 *
 * Un evento del navegador basta: son dos pantallas, no hace falta montar un
 * estado global para esto.
 */
const AJUSTES_CAMBIADOS = 'gestor:ajustes-cambiados';

export function avisarAjustesCambiados() {
  window.dispatchEvent(new Event(AJUSTES_CAMBIADOS));
}

/** Vuelve a pedir los ajustes cuando otra pantalla los toca. */
export function useAjustesCambiados(alCambiar: () => void) {
  useEffect(() => {
    const manejar = () => alCambiar();
    window.addEventListener(AJUSTES_CAMBIADOS, manejar);
    return () => window.removeEventListener(AJUSTES_CAMBIADOS, manejar);
    // Se registra una vez: `alCambiar` solo dispara una recarga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
