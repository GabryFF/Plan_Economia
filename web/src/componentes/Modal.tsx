import { useEffect, type ReactNode } from 'react';

interface Props {
  titulo: string;
  abierto: boolean;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: 'normal' | 'ancho';
}

export function Modal({ titulo, abierto, onCerrar, children, ancho = 'normal' }: Props) {
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alPulsar);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alPulsar);
      document.body.style.overflow = '';
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className={`modal modal--${ancho}`} role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="modal__cabecera">
          <h2>{titulo}</h2>
          <button type="button" className="modal__cerrar" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="modal__cuerpo">{children}</div>
      </div>
    </div>
  );
}

interface PropsConfirmacion {
  abierto: boolean;
  titulo: string;
  mensaje: ReactNode;
  textoConfirmar?: string;
  peligro?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function Confirmacion({
  abierto, titulo, mensaje, textoConfirmar = 'Confirmar', peligro = true, onConfirmar, onCancelar,
}: PropsConfirmacion) {
  return (
    <Modal titulo={titulo} abierto={abierto} onCerrar={onCancelar}>
      <div className="confirmacion">{mensaje}</div>
      <div className="acciones-formulario">
        <button type="button" className="boton boton--secundario" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="button" className={`boton ${peligro ? 'boton--peligro' : ''}`} onClick={onConfirmar}>
          {textoConfirmar}
        </button>
      </div>
    </Modal>
  );
}
