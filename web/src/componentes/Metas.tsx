import { useState, type FormEvent } from 'react';
import { ErrorApi } from '../api/cliente';
import { metas as apiMetas } from '../api/recursos';
import { Campo } from './Campos';
import { Confirmacion, Modal } from './Modal';
import { Vacio } from './Estados';
import { useAvisos } from '../hooks/useAvisos';
import type { Meta } from '../tipos';
import { aNumero, euros, porcentaje } from '../utiles/formato';

/**
 * Objetivos de ahorro con nombre: un viaje, un coche, la entrada de un piso.
 *
 * Apartar dinero NO es gastarlo, por eso esto no vive en gastos fijos: si lo
 * registraras como gasto, tu tasa de ahorro caería y el fondo de emergencia
 * subiría, las dos cosas mal.
 */

function FormularioMeta({
  meta, onGuardado, onCancelar,
}: {
  meta: Meta | null;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const { avisar } = useAvisos();
  const [nombre, setNombre] = useState(meta?.nombre ?? '');
  const [objetivo, setObjetivo] = useState(meta ? String(meta.objetivo).replace('.', ',') : '');
  const [ahorrado, setAhorrado] = useState(meta ? String(meta.ahorrado).replace('.', ',') : '');
  const [fechaObjetivo, setFechaObjetivo] = useState(meta?.fechaObjetivo ?? '');
  const [notas, setNotas] = useState(meta?.notas ?? '');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    const nuevos: Record<string, string> = {};
    const importe = aNumero(objetivo);

    if (!nombre.trim()) nuevos.nombre = 'Ponle un nombre: «Viaje a Japón», «Coche»…';
    if (importe === null || importe <= 0) nuevos.objetivo = 'Escribe cuánto quieres reunir';

    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setGuardando(true);
    try {
      const datos = {
        nombre: nombre.trim(),
        objetivo: importe as number,
        ahorrado: aNumero(ahorrado) ?? 0,
        fechaObjetivo: fechaObjetivo || null,
        notas: notas.trim(),
      };

      if (meta) {
        await apiMetas.actualizar(meta.id, datos);
        avisar('Objetivo actualizado');
      } else {
        await apiMetas.crear(datos);
        avisar('Objetivo creado');
      }
      onGuardado();
    } catch (e) {
      setErrores({ general: e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido guardar' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      {errores.general && <div className="alerta alerta--error">{errores.general}</div>}

      <Campo etiqueta="¿Para qué ahorras?" error={errores.nombre} htmlFor="meta-nombre">
        <input
          id="meta-nombre"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Viaje a Japón"
          maxLength={80}
          autoFocus
        />
      </Campo>

      <div className="rejilla-formulario">
        <Campo etiqueta="Cuánto necesitas (€)" error={errores.objetivo} htmlFor="meta-objetivo">
          <input
            id="meta-objetivo"
            type="text"
            inputMode="decimal"
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            placeholder="3000"
          />
        </Campo>

        <Campo etiqueta="Ya tienes apartado (€)" htmlFor="meta-ahorrado">
          <input
            id="meta-ahorrado"
            type="text"
            inputMode="decimal"
            value={ahorrado}
            onChange={(e) => setAhorrado(e.target.value)}
            placeholder="0"
          />
        </Campo>
      </div>

      <Campo
        etiqueta="¿Para cuándo? (opcional)"
        ayuda="Si pones fecha, te dice cuánto tendrías que apartar cada mes para llegar."
        htmlFor="meta-fecha"
      >
        <input id="meta-fecha" type="date" value={fechaObjetivo} onChange={(e) => setFechaObjetivo(e.target.value)} />
      </Campo>

      <Campo etiqueta="Notas" htmlFor="meta-notas">
        <input
          id="meta-notas"
          type="text"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Vuelos + 12 noches + JR Pass"
          maxLength={300}
        />
      </Campo>

      <div className="acciones-formulario">
        <button type="button" className="boton boton--secundario" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Guardando…' : meta ? 'Guardar cambios' : 'Crear objetivo'}
        </button>
      </div>
    </form>
  );
}

export function Metas({ metas, onCambio }: { metas: Meta[]; onCambio: () => void }) {
  const { avisar } = useAvisos();
  const [editando, setEditando] = useState<Meta | null | undefined>(undefined);
  const [borrando, setBorrando] = useState<Meta | null>(null);
  const [aportando, setAportando] = useState<Meta | null>(null);
  const [importeAporte, setImporteAporte] = useState('');

  const accion = async (fn: () => Promise<unknown>, mensaje: string) => {
    try {
      await fn();
      avisar(mensaje);
      onCambio();
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido completar', 'error');
    }
  };

  const confirmarAporte = async () => {
    const importe = aNumero(importeAporte);
    if (aportando === null || importe === null || importe === 0) return;

    await accion(() => apiMetas.aportar(aportando.id, importe), `${euros(importe)} apartados`);
    setAportando(null);
    setImporteAporte('');
  };

  return (
    <section className="tarjeta">
      <div className="cabecera-seccion">
        <h2 className="titulo-seccion">Tus objetivos de ahorro</h2>
        <button type="button" className="boton boton--secundario" onClick={() => setEditando(null)}>
          + Nuevo objetivo
        </button>
      </div>

      <p className="texto-apagado">
        Un viaje, un coche, la entrada de un piso. <strong>Apartar no es gastar</strong>: por eso esto no va en
        gastos fijos. Se llenan por orden, de arriba abajo, después del colchón de imprevistos.
      </p>

      {metas.length === 0 ? (
        <Vacio
          titulo="Aún no tienes objetivos"
          texto="Crea uno y verás cuánto tardarías en reunirlo con tu ritmo de ahorro actual."
          accion={
            <button type="button" className="boton" onClick={() => setEditando(null)}>
              + Nuevo objetivo
            </button>
          }
        />
      ) : (
        <div className="tabla-envoltorio">
          <table className="tabla">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Objetivo</th>
                <th style={{ width: '12rem' }}>Progreso</th>
                <th className="a-derecha">Te falta</th>
                <th className="a-derecha">Lo tendrás en</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {metas.map((meta, indice) => (
                <tr key={meta.id} className={meta.completada ? 'es-completada' : ''}>
                  <td className="celda-orden">
                    <button
                      type="button"
                      className="boton boton--icono"
                      onClick={() => accion(() => apiMetas.mover(meta.id, 'subir'), 'Orden actualizado')}
                      disabled={indice === 0}
                      aria-label="Subir"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="boton boton--icono"
                      onClick={() => accion(() => apiMetas.mover(meta.id, 'bajar'), 'Orden actualizado')}
                      disabled={indice === metas.length - 1}
                      aria-label="Bajar"
                    >
                      ↓
                    </button>
                  </td>
                  <td>
                    <strong>{meta.nombre}</strong>
                    {meta.completada && <span className="pastilla pastilla--ok">completado</span>}
                    <br />
                    <small className="texto-apagado">
                      {euros(meta.ahorrado)} de {euros(meta.objetivo)}
                      {meta.fechaObjetivo && ` · para el ${meta.fechaObjetivo}`}
                    </small>
                    {meta.notas && <p className="celda-nota">{meta.notas}</p>}
                  </td>
                  <td>
                    <div className="barra-consumo">
                      <div className={`barra-consumo__pista barra-consumo__pista--${meta.completada ? 'ok' : 'riesgo'}`}>
                        <span style={{ width: `${meta.progreso}%` }} />
                      </div>
                      <small>{porcentaje(meta.progreso, 0)}</small>
                    </div>
                  </td>
                  <td className="a-derecha importe">{euros(meta.restante)}</td>
                  <td className="a-derecha">
                    {meta.completada ? (
                      <span className="es-ingreso">ya está</span>
                    ) : meta.mesesEstimados !== null ? (
                      <>
                        {meta.mesesEstimados} meses
                        {meta.aporteMensualNecesario !== null && (
                          <>
                            <br />
                            <small className="texto-apagado">
                              a tiempo: {euros(meta.aporteMensualNecesario)}/mes
                            </small>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="texto-apagado">—</span>
                    )}
                  </td>
                  <td className="a-derecha celda-acciones">
                    <button type="button" className="boton boton--texto" onClick={() => setAportando(meta)}>
                      Apartar
                    </button>
                    <button type="button" className="boton boton--texto" onClick={() => setEditando(meta)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="boton boton--texto boton--peligro-texto"
                      onClick={() => setBorrando(meta)}
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="nota">
        Cuando llegue el momento de gastarlo (pagar el viaje), apúntalo como <strong>movimiento normal</strong> en su
        categoría y resta lo gastado del objetivo. Así el gasto aparece cuando ocurre y no se cuenta dos veces.
      </p>

      <Modal
        titulo={editando ? `Editar ${editando.nombre}` : 'Nuevo objetivo'}
        abierto={editando !== undefined}
        onCerrar={() => setEditando(undefined)}
      >
        <FormularioMeta
          meta={editando ?? null}
          onGuardado={() => { setEditando(undefined); onCambio(); }}
          onCancelar={() => setEditando(undefined)}
        />
      </Modal>

      <Modal
        titulo={aportando ? `Apartar para ${aportando.nombre}` : ''}
        abierto={aportando !== null}
        onCerrar={() => { setAportando(null); setImporteAporte(''); }}
      >
        <Campo
          etiqueta="¿Cuánto apartas? (€)"
          ayuda="Con importe negativo lo retiras, por ejemplo si has tenido que echar mano."
          htmlFor="meta-aporte"
        >
          <input
            id="meta-aporte"
            type="text"
            inputMode="decimal"
            value={importeAporte}
            onChange={(e) => setImporteAporte(e.target.value)}
            placeholder="100"
            autoFocus
          />
        </Campo>
        <div className="acciones-formulario">
          <button
            type="button"
            className="boton boton--secundario"
            onClick={() => { setAportando(null); setImporteAporte(''); }}
          >
            Cancelar
          </button>
          <button type="button" className="boton" onClick={confirmarAporte}>Apartar</button>
        </div>
      </Modal>

      <Confirmacion
        abierto={borrando !== null}
        titulo="Borrar objetivo"
        mensaje={
          borrando && (
            <p>
              ¿Borrar <strong>{borrando.nombre}</strong>? Solo se borra el objetivo: el dinero que tengas apartado
              sigue donde esté, la aplicación no mueve fondos.
            </p>
          )
        }
        textoConfirmar="Sí, borrar"
        onConfirmar={async () => {
          if (borrando) await accion(() => apiMetas.borrar(borrando.id), 'Objetivo borrado');
          setBorrando(null);
        }}
        onCancelar={() => setBorrando(null)}
      />
    </section>
  );
}
