import { useState, type FormEvent } from 'react';
import { ErrorApi } from '../api/cliente';
import { categorias as apiCategorias, recurrentes as apiRecurrentes } from '../api/recursos';
import { Campo, SelectorTipo } from '../componentes/Campos';
import { Cargando, ErrorCarga, Vacio } from '../componentes/Estados';
import { Confirmacion, Modal } from '../componentes/Modal';
import { useAvisos } from '../hooks/useAvisos';
import { useRecurso } from '../hooks/useRecurso';
import type { Categoria, Recurrente, Tipo } from '../tipos';
import { aNumero, euros, fechaLegible, hoyISO, primerDiaDelMes } from '../utiles/formato';

function FormularioFijo({
  fijo, categorias, onGuardado, onCancelar,
}: {
  fijo: Recurrente | null;
  categorias: Categoria[];
  onGuardado: (mensaje: string) => void;
  onCancelar: () => void;
}) {
  const hoy = new Date();
  const [nombre, setNombre] = useState(fijo?.nombre ?? '');
  const [tipo, setTipo] = useState<Tipo>(fijo?.tipo ?? 'gasto');
  const [importe, setImporte] = useState(fijo ? String(fijo.importe).replace('.', ',') : '');
  const [diaDelMes, setDiaDelMes] = useState(String(fijo?.diaDelMes ?? 1));
  const [periodicidad, setPeriodicidad] = useState(String(fijo?.periodicidad ?? 1));
  const [categoriaId, setCategoriaId] = useState(fijo?.categoriaId ? String(fijo.categoriaId) : '');
  const [fechaInicio, setFechaInicio] = useState(
    fijo?.fechaInicio ?? primerDiaDelMes(hoy.getFullYear(), hoy.getMonth() + 1)
  );
  const [fechaFin, setFechaFin] = useState(fijo?.fechaFin ?? '');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    const nuevos: Record<string, string> = {};
    const valor = aNumero(importe);
    const dia = Number(diaDelMes);

    if (!nombre.trim()) nuevos.nombre = 'Ponle un nombre, por ejemplo "Alquiler"';
    if (valor === null || valor <= 0) nuevos.importe = 'Escribe un importe mayor que 0';
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) nuevos.dia = 'El día debe estar entre 1 y 31';
    if (!fechaInicio) nuevos.fechaInicio = 'Indica desde cuándo se paga';
    if (fechaFin && fechaFin < fechaInicio) nuevos.fechaFin = 'La fecha de fin no puede ser anterior al inicio';

    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    const datos = {
      nombre: nombre.trim(),
      importe: valor,
      tipo,
      categoriaId: categoriaId ? Number(categoriaId) : null,
      diaDelMes: dia,
      periodicidad: Number(periodicidad),
      fechaInicio,
      fechaFin: fechaFin || null,
      activo: fijo?.activo ?? true,
    };

    setGuardando(true);
    try {
      if (fijo) {
        await apiRecurrentes.actualizar(fijo.id, datos);
        onGuardado('Movimiento fijo actualizado');
      } else {
        await apiRecurrentes.crear(datos);
        onGuardado('Movimiento fijo creado. Se han generado los movimientos ya vencidos.');
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

      <Campo etiqueta="¿Es un ingreso fijo o un gasto fijo?">
        <SelectorTipo valor={tipo} onCambiar={(t) => { setTipo(t); setCategoriaId(''); }} />
      </Campo>

      <Campo etiqueta="Nombre" error={errores.nombre} htmlFor="fijo-nombre">
        <input
          id="fijo-nombre"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={tipo === 'ingreso' ? 'Nómina' : 'Alquiler, Netflix, Gimnasio…'}
          maxLength={80}
          autoFocus
        />
      </Campo>

      <div className="rejilla-formulario">
        <Campo etiqueta="Importe (€)" error={errores.importe} htmlFor="fijo-importe">
          <input
            id="fijo-importe"
            type="text"
            inputMode="decimal"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            placeholder="750,00"
          />
        </Campo>

        <Campo
          etiqueta="Día del mes"
          error={errores.dia}
          ayuda="Si pones 31, en febrero se usará el último día."
          htmlFor="fijo-dia"
        >
          <input
            id="fijo-dia"
            type="number"
            min={1}
            max={31}
            value={diaDelMes}
            onChange={(e) => setDiaDelMes(e.target.value)}
          />
        </Campo>
      </div>

      <Campo
        etiqueta="¿Cada cuánto se paga?"
        ayuda="El seguro del coche, la ITV o el IBI no son mensuales, pero sí predecibles."
        htmlFor="fijo-periodicidad"
      >
        <select id="fijo-periodicidad" value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value)}>
          <option value="1">Todos los meses</option>
          <option value="2">Cada 2 meses</option>
          <option value="3">Cada 3 meses (trimestral)</option>
          <option value="6">Cada 6 meses (semestral)</option>
          <option value="12">Una vez al año</option>
        </select>
      </Campo>

      <Campo etiqueta="Categoría" htmlFor="fijo-categoria">
        <select id="fijo-categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">Sin categoría</option>
          {categorias.filter((c) => c.tipo === tipo && !c.archivada).map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </Campo>

      <div className="rejilla-formulario">
        <Campo
          etiqueta="Desde"
          error={errores.fechaInicio}
          ayuda="Se generarán los movimientos desde esta fecha."
          htmlFor="fijo-inicio"
        >
          <input id="fijo-inicio" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
        </Campo>

        <Campo etiqueta="Hasta (opcional)" error={errores.fechaFin} ayuda="Déjalo vacío si no tiene fin." htmlFor="fijo-fin">
          <input id="fijo-fin" type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
        </Campo>
      </div>

      <div className="acciones-formulario">
        <button type="button" className="boton boton--secundario" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Guardando…' : fijo ? 'Guardar cambios' : 'Crear movimiento fijo'}
        </button>
      </div>
    </form>
  );
}

export function PaginaFijos() {
  const { avisar } = useAvisos();
  const [editando, setEditando] = useState<Recurrente | null | undefined>(undefined);
  const [borrando, setBorrando] = useState<Recurrente | null>(null);
  const [borrarGenerados, setBorrarGenerados] = useState(false);

  const listado = useRecurso(() => apiRecurrentes.listar(), []);
  const categorias = useRecurso(() => apiCategorias.listar(), []);

  const trasGuardar = (mensaje: string) => {
    setEditando(undefined);
    listado.recargar();
    avisar(mensaje);
  };

  const alternarActivo = async (fijo: Recurrente) => {
    try {
      await apiRecurrentes.actualizar(fijo.id, { activo: !fijo.activo });
      avisar(fijo.activo ? 'Pausado: dejará de generar movimientos' : 'Reactivado');
      listado.recargar();
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido actualizar', 'error');
    }
  };

  const generar = async () => {
    try {
      const { creados } = await apiRecurrentes.generar();
      avisar(creados > 0 ? `${creados} movimiento(s) generado(s)` : 'Todo estaba al día, no había nada que generar', 'info');
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido generar', 'error');
    }
  };

  const confirmarBorrado = async () => {
    if (!borrando) return;
    try {
      const resultado = await apiRecurrentes.borrar(borrando.id, borrarGenerados);
      avisar(
        borrarGenerados
          ? `Eliminado junto con ${resultado.generadosBorrados} movimiento(s) generados`
          : 'Eliminado. Los movimientos ya registrados se conservan.'
      );
      listado.recargar();
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido borrar', 'error');
    } finally {
      setBorrando(null);
      setBorrarGenerados(false);
    }
  };

  const activos = (listado.datos ?? []).filter((f) => f.activo);
  // Se suma el coste mensual equivalente: un seguro anual de 720 € pesa 60 € al mes.
  const totalPor = (tipo: Tipo) => activos.filter((f) => f.tipo === tipo).reduce((s, f) => s + f.costeMensual, 0);
  const ingresosFijos = totalPor('ingreso');
  const gastosFijos = totalPor('gasto');

  return (
    <>
      <header className="cabecera-pagina">
        <div>
          <h1>Gastos fijos e ingresos recurrentes</h1>
          <p className="texto-apagado">
            Todo lo que se repite cada mes: nómina, alquiler, suscripciones, seguros… Lo defines una vez y la
            aplicación registra los movimientos por ti.
          </p>
        </div>
        <div className="cabecera-pagina__acciones">
          <button type="button" className="boton boton--secundario" onClick={generar}>
            Actualizar ahora
          </button>
          <button type="button" className="boton" onClick={() => setEditando(null)}>+ Nuevo fijo</button>
        </div>
      </header>

      {listado.datos && listado.datos.length > 0 && (
        <section className="rejilla-indicadores">
          <div className="indicador indicador--ingreso">
            <span className="indicador__titulo">Ingresos fijos al mes</span>
            <strong className="indicador__valor">{euros(ingresosFijos)}</strong>
          </div>
          <div className="indicador indicador--gasto">
            <span className="indicador__titulo">Gastos fijos al mes</span>
            <strong className="indicador__valor">{euros(gastosFijos)}</strong>
          </div>
          <div className={`indicador indicador--${ingresosFijos - gastosFijos >= 0 ? 'acento' : 'gasto'}`}>
            <span className="indicador__titulo">Te queda libre cada mes</span>
            <strong className="indicador__valor">{euros(ingresosFijos - gastosFijos)}</strong>
            <span className="indicador__detalle">Antes de los gastos variables</span>
          </div>
        </section>
      )}

      <section className="tarjeta">
        {listado.cargando && <Cargando />}
        {listado.error && <ErrorCarga mensaje={listado.error} onReintentar={listado.recargar} />}

        {listado.datos && listado.datos.length === 0 && (
          <Vacio
            titulo="Aún no has configurado ningún movimiento fijo"
            texto="Empieza por tu nómina y por el alquiler o la hipoteca: son los que más peso tienen en tu ahorro."
            accion={<button type="button" className="boton" onClick={() => setEditando(null)}>+ Nuevo fijo</button>}
          />
        )}

        {listado.datos && listado.datos.length > 0 && (
          <div className="tabla-envoltorio">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Cuándo</th>
                  <th>Vigencia</th>
                  <th className="a-derecha">Importe</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {listado.datos.map((f) => (
                  <tr key={f.id} className={f.activo ? '' : 'es-archivada'}>
                    <td>
                      {f.nombre}
                      {!f.activo && <span className="pastilla">pausado</span>}
                    </td>
                    <td>
                      {f.categoriaNombre ? (
                        <span
                          className="pastilla-categoria"
                          style={{ backgroundColor: `${f.categoriaColor}1f`, color: f.categoriaColor ?? undefined }}
                        >
                          {f.categoriaNombre}
                        </span>
                      ) : (
                        <span className="texto-apagado">Sin categoría</span>
                      )}
                    </td>
                    <td>
                      Día {f.diaDelMes}
                      {f.periodicidad > 1 && (
                        <>
                          <br />
                          <small className="texto-apagado">
                            {f.periodicidad === 12 ? 'una vez al año' : `cada ${f.periodicidad} meses`}
                          </small>
                        </>
                      )}
                    </td>
                    <td className="celda-fecha">
                      {f.fechaFin
                        ? `${fechaLegible(f.fechaInicio)} → ${fechaLegible(f.fechaFin)}`
                        : `Desde el ${fechaLegible(f.fechaInicio)}`}
                    </td>
                    <td className={`a-derecha importe ${f.tipo === 'ingreso' ? 'es-ingreso' : 'es-gasto'}`}>
                      {f.tipo === 'ingreso' ? '+' : '−'} {euros(f.importe)}
                      {f.periodicidad > 1 && (
                        <>
                          <br />
                          <small className="texto-apagado">{euros(f.costeMensual)} al mes</small>
                        </>
                      )}
                    </td>
                    <td className="a-derecha celda-acciones">
                      <button type="button" className="boton boton--texto" onClick={() => setEditando(f)}>Editar</button>
                      <button type="button" className="boton boton--texto" onClick={() => alternarActivo(f)}>
                        {f.activo ? 'Pausar' : 'Reactivar'}
                      </button>
                      <button
                        type="button"
                        className="boton boton--texto boton--peligro-texto"
                        onClick={() => setBorrando(f)}
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
          Los movimientos se generan automáticamente hasta la fecha de hoy ({hoyISO()}) cada vez que abres la
          aplicación. Puedes editarlos uno a uno desde <strong>Movimientos</strong> si algún mes cambia el importe.
        </p>

        <p className="nota">
          <strong>¿Te suben el sueldo?</strong> Edita aquí la nómina y pon el importe nuevo. Los recibos ya cobrados
          conservan su importe antiguo —el histórico no se reescribe— y todos los cálculos (presupuestos
          recomendados, plazos, tasa de ahorro) pasan a usar el nuevo desde ese mismo momento. Si además cambias de
          tramo de renta, el perfil de referencia de los presupuestos se ajusta solo.
        </p>
      </section>

      <Modal
        titulo={editando ? 'Editar movimiento fijo' : 'Nuevo movimiento fijo'}
        abierto={editando !== undefined}
        onCerrar={() => setEditando(undefined)}
      >
        <FormularioFijo
          fijo={editando ?? null}
          categorias={categorias.datos ?? []}
          onGuardado={trasGuardar}
          onCancelar={() => setEditando(undefined)}
        />
      </Modal>

      <Confirmacion
        abierto={borrando !== null}
        titulo="Borrar movimiento fijo"
        mensaje={
          borrando && (
            <>
              <p>
                Vas a borrar <strong>{borrando.nombre}</strong>. Dejará de generar movimientos nuevos.
              </p>
              <label className="interruptor">
                <input
                  type="checkbox"
                  checked={borrarGenerados}
                  onChange={(e) => setBorrarGenerados(e.target.checked)}
                />
                Borrar también los movimientos que ya generó
              </label>
              <p className="texto-apagado">
                Si lo dejas sin marcar, el histórico se conserva tal cual (recomendado).
              </p>
            </>
          )
        }
        textoConfirmar="Sí, borrar"
        onConfirmar={confirmarBorrado}
        onCancelar={() => { setBorrando(null); setBorrarGenerados(false); }}
      />
    </>
  );
}
