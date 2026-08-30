import { useCallback, useEffect, useState } from 'react';
import { ErrorApi } from '../api/cliente';

interface EstadoRecurso<T> {
  datos: T | null;
  cargando: boolean;
  error: string | null;
  recargar: () => void;
}

/**
 * Carga datos de la API y expone estado de carga/error uniforme.
 * `dependencias` marca cuándo hay que volver a pedirlos.
 */
export function useRecurso<T>(cargar: () => Promise<T>, dependencias: unknown[] = []): EstadoRecurso<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contador, setContador] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cargarMemo = useCallback(cargar, dependencias);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);

    cargarMemo()
      .then((resultado) => {
        if (!cancelado) setDatos(resultado);
      })
      .catch((e: unknown) => {
        if (!cancelado) setError(e instanceof ErrorApi ? e.textoCompleto : 'Error inesperado al cargar los datos');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [cargarMemo, contador]);

  return { datos, cargando, error, recargar: () => setContador((c) => c + 1) };
}
