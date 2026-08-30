import { useState, type FormEvent } from 'react';
import { ErrorApi } from '../api/cliente';
import { categorias as apiCategorias } from '../api/recursos';
import { Campo, SelectorTipo } from '../componentes/Campos';
import { Cargando, ErrorCarga, Vacio } from '../componentes/Estados';
import { Confirmacion, Modal } from '../componentes/Modal';
import { useAvisos } from '../hooks/useAvisos';
import { useRecurso } from '../hooks/useRecurso';
import type { Categoria, Tipo } from '../tipos';

const COLORES = [
  '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#16a34a', '#059669',
  '#0891b2', '#2563eb', '#4f46e5', '#7c3aed', '#c026d3', '#db2777', '#64748b',
];

function FormularioCategoria({
  categoria, onGuardado, onCancelar,
}: {
  categoria: Categoria | null;
  onGuardado: (mensaje: string) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? '');
  const [tipo, setTipo] = useState<Tipo>(categoria?.tipo ?? 'gasto');
  const [color, setColor] = useState(categoria?.color ?? COLORES[0]);
  const [error, setError] = useState<string | null>(null);
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!nombre.trim()) {
      setErrorNombre('Ponle un nombre a la categoría');
      return;
    }
    setErrorNombre(null);
    setGuardando(true);

    try {
      if (categoria) {
        await apiCategorias.actualizar(categoria.id, { nombre: nombre.trim(), tipo, color });
        onGuardado('Categoría actualizada');
      } else {
        await apiCategorias.crear({ nombre: nombre.trim(), tipo, color });
        onGuardado('Categoría creada');
      }
    } catch (e) {
      setError(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      {error && <div className="alerta alerta--error">{error}</div>}

      <Campo etiqueta="Nombre" error={errorNombre ?? undefined} htmlFor="cat-nombre">
        <input
          id="cat-nombre"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Alimentación, Gimnasio, Nómina…"
          maxLength={60}
          autoFocus
        />
      </Campo>

      <Campo
        etiqueta="¿Es una categoría de gasto o de ingreso?"
        ayuda={categoria && categoria.movimientos > 0 ? 'Cambiar el tipo dejará sin categoría los movimientos ya asignados.' : undefined}
      >
        <SelectorTipo valor={tipo} onCambiar={setTipo} />
      </Campo>

      <Campo etiqueta="Color" ayuda="Se usa en los gráficos y en las etiquetas.">
        <div className="paleta">
          {COLORES.map((c) => (
            <button
              key={c}
              type="button"
              className={`paleta__color ${color === c ? 'es-activo' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      </Campo>

      <div className="acciones-formulario">
        <button type="button" className="boton boton--secundario" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Guardando…' : categoria ? 'Guardar cambios' : 'Crear categoría'}
        </button>
      </div>
    </form>
  );
}

export function PaginaCategorias() {
  const { avisar } = useAvisos();
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [editando, setEditando] = useState<Categoria | null | undefined>(undefined);
  const [borrando, setBorrando] = useState<Categoria | null>(null);

  const listado = useRecurso(() => apiCategorias.listar(verArchivadas), [verArchivadas]);

  const trasGuardar = (mensaje: string) => {
    setEditando(undefined);
    listado.recargar();
    avisar(mensaje);
  };

  const alternarArchivado = async (categoria: Categoria) => {
    try {
      await apiCategorias.actualizar(categoria.id, { archivada: !categoria.archivada });
      avisar(categoria.archivada ? 'Categoría reactivada' : 'Categoría archivada');
      listado.recargar();
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido actualizar', 'error');
    }
  };

  const confirmarBorrado = async () => {
    if (!borrando) return;
    try {
      const resultado = await apiCategorias.borrar(borrando.id, true);
      avisar(
        resultado.movimientosAfectados > 0
          ? `Categoría borrada. ${resultado.movimientosAfectados} movimiento(s) han quedado sin categoría.`
          : 'Categoría borrada'
      );
      listado.recargar();
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido borrar', 'error');
    } finally {
      setBorrando(null);
    }
  };

  const porTipo = (tipo: Tipo) => (listado.datos ?? []).filter((c) => c.tipo === tipo);

  const tabla = (tipo: Tipo, titulo: string) => {
    const filas = porTipo(tipo);
    return (
      <section className="tarjeta">
        <h2 className="titulo-seccion">{titulo}</h2>
        {filas.length === 0 ? (
          <Vacio titulo={`No hay categorías de ${tipo}`} texto="Crea la primera con el botón de arriba." />
        ) : (
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th className="a-derecha">Movimientos</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {filas.map((c) => (
                  <tr key={c.id} className={c.archivada ? 'es-archivada' : ''}>
                    <td>
                      <span className="punto-color" style={{ backgroundColor: c.color }} />
                      {c.nombre}
                      {c.archivada && <span className="pastilla">archivada</span>}
                    </td>
                    <td className="a-derecha">{c.movimientos}</td>
                    <td className="a-derecha celda-acciones">
                      <button type="button" className="boton boton--texto" onClick={() => setEditando(c)}>Editar</button>
                      <button type="button" className="boton boton--texto" onClick={() => alternarArchivado(c)}>
                        {c.archivada ? 'Reactivar' : 'Archivar'}
                      </button>
                      <button
                        type="button"
                        className="boton boton--texto boton--peligro-texto"
                        onClick={() => setBorrando(c)}
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
      </section>
    );
  };

  return (
    <>
      <header className="cabecera-pagina">
        <div>
          <h1>Categorías</h1>
          <p className="texto-apagado">
            Sirven para agrupar tus movimientos. Archiva las que ya no uses en lugar de borrarlas: así conservas el histórico.
          </p>
        </div>
        <div className="cabecera-pagina__acciones">
          <label className="interruptor">
            <input type="checkbox" checked={verArchivadas} onChange={(e) => setVerArchivadas(e.target.checked)} />
            Ver archivadas
          </label>
          <button type="button" className="boton" onClick={() => setEditando(null)}>+ Nueva categoría</button>
        </div>
      </header>

      {listado.cargando && <Cargando />}
      {listado.error && <ErrorCarga mensaje={listado.error} onReintentar={listado.recargar} />}

      {listado.datos && (
        <div className="rejilla-dos">
          {tabla('gasto', 'Gastos')}
          {tabla('ingreso', 'Ingresos')}
        </div>
      )}

      <Modal
        titulo={editando ? 'Editar categoría' : 'Nueva categoría'}
        abierto={editando !== undefined}
        onCerrar={() => setEditando(undefined)}
      >
        <FormularioCategoria
          categoria={editando ?? null}
          onGuardado={trasGuardar}
          onCancelar={() => setEditando(undefined)}
        />
      </Modal>

      <Confirmacion
        abierto={borrando !== null}
        titulo="Borrar categoría"
        mensaje={
          borrando && (
            <>
              <p>
                Vas a borrar la categoría <strong>{borrando.nombre}</strong>.
              </p>
              {borrando.movimientos > 0 && (
                <p className="alerta alerta--aviso">
                  Tiene {borrando.movimientos} movimiento(s) asociados. No se borrarán, pero quedarán{' '}
                  <strong>sin categoría</strong>. Si solo quieres dejar de usarla, mejor archívala.
                </p>
              )}
            </>
          )
        }
        textoConfirmar="Sí, borrar"
        onConfirmar={confirmarBorrado}
        onCancelar={() => setBorrando(null)}
      />
    </>
  );
}
