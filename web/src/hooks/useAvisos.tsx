import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type TipoAviso = 'exito' | 'error' | 'info';

/**
 * Acción opcional dentro del aviso, para deshacer lo que se acaba de hacer.
 *
 * Un «¿Seguro?» antes de borrar interrumpe siempre, incluso cuando aciertas;
 * un «Deshacer» después solo aparece cuando te equivocas. Como el aviso dura
 * unos segundos, el que lleva acción vive más: hay que leerlo y decidir.
 */
interface AccionAviso {
  texto: string;
  alPulsar: () => void | Promise<void>;
}

interface Aviso { id: number; tipo: TipoAviso; texto: string; accion?: AccionAviso }

interface ContextoAvisos {
  avisar: (texto: string, tipo?: TipoAviso, accion?: AccionAviso) => void;
}

const Contexto = createContext<ContextoAvisos>({ avisar: () => {} });

const DURACION = 5000;
const DURACION_CON_ACCION = 10000;

/** Notificaciones efímeras (abajo a la derecha). */
export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const descartar = useCallback((id: number) => {
    setAvisos((actuales) => actuales.filter((a) => a.id !== id));
  }, []);

  const avisar = useCallback(
    (texto: string, tipo: TipoAviso = 'exito', accion?: AccionAviso) => {
      const id = Date.now() + Math.random();
      setAvisos((actuales) => [...actuales, { id, tipo, texto, accion }]);
      setTimeout(() => descartar(id), accion ? DURACION_CON_ACCION : DURACION);
    },
    [descartar]
  );

  const valor = useMemo(() => ({ avisar }), [avisar]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((aviso) => (
          <div key={aviso.id} className={`aviso aviso--${aviso.tipo}`}>
            <span>{aviso.texto}</span>
            {aviso.accion && (
              <button
                type="button"
                className="aviso__accion"
                onClick={() => {
                  // Se quita al pulsar: el aviso ya no describe lo que pasa.
                  descartar(aviso.id);
                  void aviso.accion?.alPulsar();
                }}
              >
                {aviso.accion.texto}
              </button>
            )}
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export const useAvisos = () => useContext(Contexto);
