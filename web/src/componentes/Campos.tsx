import type { ReactNode } from 'react';

interface PropsCampo {
  etiqueta: string;
  error?: string;
  ayuda?: string;
  children: ReactNode;
  htmlFor?: string;
}

/** Envoltorio de campo de formulario: etiqueta, ayuda y mensaje de error. */
export function Campo({ etiqueta, error, ayuda, children, htmlFor }: PropsCampo) {
  return (
    <div className={`campo ${error ? 'campo--error' : ''}`}>
      <label htmlFor={htmlFor}>{etiqueta}</label>
      {children}
      {ayuda && !error && <small className="campo__ayuda">{ayuda}</small>}
      {error && <small className="campo__error">{error}</small>}
    </div>
  );
}

/** Selector ingreso/gasto como par de botones: más claro que un desplegable. */
export function SelectorTipo({ valor, onCambiar }: { valor: 'ingreso' | 'gasto'; onCambiar: (t: 'ingreso' | 'gasto') => void }) {
  return (
    <div className="selector-tipo">
      <button
        type="button"
        className={`selector-tipo__opcion ${valor === 'gasto' ? 'es-activo es-gasto' : ''}`}
        onClick={() => onCambiar('gasto')}
      >
        Gasto
      </button>
      <button
        type="button"
        className={`selector-tipo__opcion ${valor === 'ingreso' ? 'es-activo es-ingreso' : ''}`}
        onClick={() => onCambiar('ingreso')}
      >
        Ingreso
      </button>
    </div>
  );
}
