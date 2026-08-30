import type { ReactNode } from 'react';

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="estado estado--cargando">
      <span className="girador" aria-hidden="true" />
      {texto}
    </div>
  );
}

export function ErrorCarga({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <div className="estado estado--error">
      <strong>No se han podido cargar los datos</strong>
      <span>{mensaje}</span>
      {onReintentar && (
        <button type="button" className="boton boton--secundario" onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}

/** Estado vacío con una acción sugerida: evita pantallas en blanco sin explicación. */
export function Vacio({ titulo, texto, accion }: { titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="estado estado--vacio">
      <strong>{titulo}</strong>
      {texto && <span>{texto}</span>}
      {accion}
    </div>
  );
}
