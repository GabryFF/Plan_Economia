import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ErrorApi } from '../api/cliente';
import { categorias as apiCategorias, reglas as apiReglas } from '../api/recursos';
import { Campo, SelectorTipo } from '../componentes/Campos';
import { Cargando, ErrorCarga, Vacio } from '../componentes/Estados';
import { Confirmacion, Modal } from '../componentes/Modal';
import { useAvisos } from '../hooks/useAvisos';
import { useRecurso } from '../hooks/useRecurso';
import type { Categoria, Coincidencia, CoincidenciaRegla, Regla, Tipo } from '../tipos';

const COINCIDENCIAS: { valor: Coincidencia; etiqueta: string; ejemplo: string }[] = [
  { valor: 'contiene', etiqueta: 'Contiene el texto', ejemplo: 'MERCADONA → «COMPRA MERCADONA MADRID»' },
  { valor: 'empieza', etiqueta: 'Empieza por', ejemplo: 'RECIBO → «RECIBO LUZ AGOSTO»' },
  { valor: 'termina', etiqueta: 'Termina en', ejemplo: 'DEVOLUCION → «AMAZON DEVOLUCION»' },
  { valor: 'exacto', etiqueta: 'Es exactamente', ejemplo: 'NOMINA → solo «NOMINA»' },
];

const TEXTO_COINCIDENCIA: Record<Coincidencia, string> = {
  contiene: 'contiene',
  empieza: 'empieza por',
  termina: 'termina en',
  exacto: 'es exactamente',
};

function FormularioRegla({
  regla, categorias, onGuardado, onCancelar,
}: {
  regla: Regla | null;
  categorias: Categoria[];
  onGuardado: (mensaje: string) => void;
  onCancelar: () => void;
}) {
  const [patron, setPatron] = useState(regla?.patron ?? '');
  const [coincidencia, setCoincidencia] = useState<Coincidencia>(regla?.coincidencia ?? 'contiene');
  const [tipo, setTipo] = useState<Tipo>(regla?.categoriaTipo ?? 'gasto');
  const [categoriaId, setCategoriaId] = useState(regla ? String(regla.categoriaId) : '');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const disponibles = categorias.filter((c) => c.tipo === tipo && !c.archivada);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    const nuevos: Record<string, string> = {};

    if (!patron.trim()) nuevos.patron = 'Escribe el texto que aparece en el concepto del banco';
    if (!categoriaId) nuevos.categoria = 'Elige a qué categoría asignarlo';

    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    setGuardando(true);
    try {
      const datos = { patron: patron.trim(), coincidencia, categoriaId: Number(categoriaId) };
      if (regla) {
        await apiReglas.actualizar(regla.id, datos);
        onGuardado('Regla actualizada');
      } else {
        await apiReglas.crear(datos);
        onGuardado('Regla creada');
      }
    } catch (e) {
      setErrores({ general: e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido guardar' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      {errores.general && <div className="alerta alerta--error">{errores.general}</div>}

      <Campo etiqueta="¿Es una regla para gastos o para ingresos?">
        <SelectorTipo valor={tipo} onCambiar={(t) => { setTipo(t); setCategoriaId(''); }} />
      </Campo>

      <Campo
        etiqueta="Texto a buscar en el concepto"
        error={errores.patron}
        ayuda="No importan mayúsculas, tildes ni espacios de más."
        htmlFor="regla-patron"
      >
        <input
          id="regla-patron"
          type="text"
          value={patron}
          onChange={(e) => setPatron(e.target.value)}
          placeholder="MERCADONA"
          maxLength={120}
          autoFocus
        />
      </Campo>

      <Campo etiqueta="¿Cómo debe coincidir?">
        <div className="opciones-regla">
          {COINCIDENCIAS.map((opcion) => (
            <label
              key={opcion.valor}
              className={`opcion-regla ${coincidencia === opcion.valor ? 'es-activo' : ''}`}
            >
              <input
                type="radio"
                name="coincidencia"
                checked={coincidencia === opcion.valor}
                onChange={() => setCoincidencia(opcion.valor)}
              />
              <span>
                <strong>{opcion.etiqueta}</strong>
                <small>{opcion.ejemplo}</small>
              </span>
            </label>
          ))}
        </div>
      </Campo>

      <Campo etiqueta="Asignar a la categoría" error={errores.categoria} htmlFor="regla-categoria">
        <select id="regla-categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">Elige una categoría…</option>
          {disponibles.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </Campo>

      <div className="acciones-formulario">
        <button type="button" className="boton boton--secundario" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Guardando…' : regla ? 'Guardar cambios' : 'Crear regla'}
        </button>
      </div>
    </form>
  );
}

/** Probador: pega un concepto real del banco y comprueba qué regla lo captura. */
function Probador() {
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState<Tipo>('gasto');
  const [resultado, setResultado] = useState<CoincidenciaRegla | null | undefined>(undefined);
  const [probando, setProbando] = useState(false);

  const probar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!texto.trim()) return;

    setProbando(true);
    try {
      const { coincidencia } = await apiReglas.probar(texto.trim(), tipo);
      setResultado(coincidencia);
    } finally {
      setProbando(false);
    }
  };

  return (
    <form className="probador" onSubmit={probar}>
      <div className="probador__campos">
        <input
          type="text"
          value={texto}
          onChange={(e) => { setTexto(e.target.value); setResultado(undefined); }}
          placeholder="Pega aquí un concepto del banco: COMPRA MERCADONA MADRID"
          aria-label="Texto de prueba"
        />
        <select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)} aria-label="Tipo">
          <option value="gasto">Gasto</option>
          <option value="ingreso">Ingreso</option>
        </select>
        <button type="submit" className="boton boton--secundario" disabled={probando || !texto.trim()}>
          Probar
        </button>
      </div>

      {resultado !== undefined && (
        <div className={`alerta ${resultado ? 'alerta--info' : 'alerta--aviso'}`}>
          {resultado ? (
            <>
              Se asignaría a{' '}
              <span
                className="pastilla-categoria"
                style={{ backgroundColor: `${resultado.categoriaColor}1f`, color: resultado.categoriaColor }}
              >
                {resultado.categoriaNombre}
              </span>{' '}
              por la regla «{resultado.patron}».
            </>
          ) : (
            'Ninguna regla captura este concepto. Créala con el botón de arriba.'
          )}
        </div>
      )}
    </form>
  );
}

export function PaginaReglas() {
  const { avisar } = useAvisos();
  const [editando, setEditando] = useState<Regla | null | undefined>(undefined);
  const [borrando, setBorrando] = useState<Regla | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);

  const listado = useRecurso(() => apiReglas.listar(), []);
  const categorias = useRecurso(() => apiCategorias.listar(), []);

  const trasGuardar = (mensaje: string) => {
    setEditando(undefined);
    listado.recargar();
    avisar(mensaje);
  };

  const mover = async (regla: Regla, direccion: 'subir' | 'bajar') => {
    try {
      await apiReglas.mover(regla.id, direccion);
      listado.recargar();
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido reordenar', 'error');
    }
  };

  const alternarActiva = async (regla: Regla) => {
    try {
      await apiReglas.actualizar(regla.id, { activa: !regla.activa });
      listado.recargar();
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido actualizar', 'error');
    }
  };

  const confirmarBorrado = async () => {
    if (!borrando) return;
    try {
      await apiReglas.borrar(borrando.id);
      avisar('Regla eliminada');
      listado.recargar();
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido borrar', 'error');
    } finally {
      setBorrando(null);
    }
  };

  const cargarCatalogo = async () => {
    setCargandoCatalogo(true);
    try {
      const resultado = await apiReglas.cargarCatalogo();

      const partes = [];
      if (resultado.creadas > 0) partes.push(`${resultado.creadas} reglas añadidas`);
      if (resultado.yaExistian > 0) partes.push(`${resultado.yaExistian} ya las tenías`);
      if (resultado.categoriasQueFaltan.length > 0) {
        partes.push(`omitidas las de: ${resultado.categoriasQueFaltan.join(', ')} (no existe esa categoría)`);
      }

      avisar(partes.join(' · ') || 'No había nada que añadir', resultado.creadas > 0 ? 'exito' : 'info');
      listado.recargar();
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido cargar el catálogo', 'error');
    } finally {
      setCargandoCatalogo(false);
    }
  };

  const aplicarAlHistorico = async () => {
    setAplicando(true);
    try {
      const resultado = await apiReglas.aplicar();
      avisar(
        resultado.actualizados > 0
          ? `${resultado.actualizados} de ${resultado.revisados} movimientos sin categoría se han clasificado`
          : 'No había movimientos sin categoría que encajaran con tus reglas',
        resultado.actualizados > 0 ? 'exito' : 'info'
      );
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido aplicar', 'error');
    } finally {
      setAplicando(false);
    }
  };

  return (
    <>
      <header className="cabecera-pagina">
        <div>
          <h1>Reglas de categorización</h1>
          <p className="texto-apagado">
            Clasifican solas los movimientos al importar, mirando el concepto que escribe el banco. Se evalúan de
            arriba abajo y gana la primera que coincide.
          </p>
        </div>
        <div className="cabecera-pagina__acciones">
          <button type="button" className="boton boton--secundario" onClick={cargarCatalogo} disabled={cargandoCatalogo}>
            {cargandoCatalogo ? 'Cargando…' : 'Cargar reglas típicas de España'}
          </button>
          <button type="button" className="boton boton--secundario" onClick={aplicarAlHistorico} disabled={aplicando}>
            {aplicando ? 'Aplicando…' : 'Aplicar al histórico'}
          </button>
          <button type="button" className="boton" onClick={() => setEditando(null)}>+ Nueva regla</button>
        </div>
      </header>

      <section className="tarjeta">
        {listado.cargando && <Cargando />}
        {listado.error && <ErrorCarga mensaje={listado.error} onReintentar={listado.recargar} />}

        {listado.datos && listado.datos.length === 0 && (
          <Vacio
            titulo="Todavía no tienes reglas"
            texto="Con una regla como «MERCADONA → Alimentación» no vuelves a categorizar esa compra nunca más."
            accion={
              <div className="acciones-formulario acciones-formulario--izquierda">
                <button type="button" className="boton" onClick={cargarCatalogo} disabled={cargandoCatalogo}>
                  Cargar reglas típicas de España
                </button>
                <button type="button" className="boton boton--secundario" onClick={() => setEditando(null)}>
                  + Nueva regla
                </button>
              </div>
            }
          />
        )}

        {listado.datos && listado.datos.length > 0 && (
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Si el concepto…</th>
                  <th>Se asigna a</th>
                  <th>Tipo</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {listado.datos.map((regla, indice) => (
                  <tr key={regla.id} className={regla.activa ? '' : 'es-archivada'}>
                    <td className="celda-orden">
                      <button
                        type="button"
                        className="boton boton--icono"
                        onClick={() => mover(regla, 'subir')}
                        disabled={indice === 0}
                        aria-label="Subir"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="boton boton--icono"
                        onClick={() => mover(regla, 'bajar')}
                        disabled={indice === listado.datos!.length - 1}
                        aria-label="Bajar"
                      >
                        ↓
                      </button>
                    </td>
                    <td>
                      <span className="texto-apagado">{TEXTO_COINCIDENCIA[regla.coincidencia]}</span>{' '}
                      <strong>«{regla.patron}»</strong>
                      {!regla.activa && <span className="pastilla">desactivada</span>}
                    </td>
                    <td>
                      <span
                        className="pastilla-categoria"
                        style={{ backgroundColor: `${regla.categoriaColor}1f`, color: regla.categoriaColor }}
                      >
                        {regla.categoriaNombre}
                      </span>
                    </td>
                    <td>{regla.categoriaTipo === 'ingreso' ? 'Ingreso' : 'Gasto'}</td>
                    <td className="a-derecha celda-acciones">
                      <button type="button" className="boton boton--texto" onClick={() => setEditando(regla)}>Editar</button>
                      <button type="button" className="boton boton--texto" onClick={() => alternarActiva(regla)}>
                        {regla.activa ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        className="boton boton--texto boton--peligro-texto"
                        onClick={() => setBorrando(regla)}
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
          Las reglas solo rellenan huecos: si el fichero que importas ya trae una columna de categoría, esa manda.
          Puedes revisar el resultado antes de guardar nada en <Link to="/datos">Importar / Exportar</Link>.
        </p>
      </section>

      <section className="tarjeta">
        <h2 className="titulo-seccion">Probar una regla</h2>
        <p className="texto-apagado">
          Pega el concepto tal cual aparece en tu extracto y comprueba qué categoría le tocaría.
        </p>
        <Probador />
      </section>

      <Modal
        titulo={editando ? 'Editar regla' : 'Nueva regla'}
        abierto={editando !== undefined}
        onCerrar={() => setEditando(undefined)}
      >
        <FormularioRegla
          regla={editando ?? null}
          categorias={categorias.datos ?? []}
          onGuardado={trasGuardar}
          onCancelar={() => setEditando(undefined)}
        />
      </Modal>

      <Confirmacion
        abierto={borrando !== null}
        titulo="Borrar regla"
        mensaje={
          borrando && (
            <p>
              ¿Borrar la regla <strong>«{borrando.patron}» → {borrando.categoriaNombre}</strong>? Los movimientos
              que ya clasificó conservan su categoría.
            </p>
          )
        }
        textoConfirmar="Sí, borrar"
        onConfirmar={confirmarBorrado}
        onCancelar={() => setBorrando(null)}
      />
    </>
  );
}
