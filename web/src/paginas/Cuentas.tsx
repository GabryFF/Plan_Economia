import { useState, type FormEvent } from 'react';
import { ErrorApi } from '../api/cliente';
import { cuentas as apiCuentas } from '../api/recursos';
import { Campo } from '../componentes/Campos';
import { Cargando, ErrorCarga, Vacio } from '../componentes/Estados';
import { Confirmacion, Modal } from '../componentes/Modal';
import { useAvisos } from '../hooks/useAvisos';
import { useRecurso } from '../hooks/useRecurso';
import type { Cuenta, ListaCuentas, Traspaso } from '../tipos';
import { aNumero, euros, fechaLegible, hoyISO } from '../utiles/formato';

const TIPOS = [
  { valor: 'corriente', etiqueta: 'Cuenta corriente' },
  { valor: 'ahorro', etiqueta: 'Cuenta de ahorro' },
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'tarjeta', etiqueta: 'Tarjeta' },
];

const COLORES = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#64748b'];

function FormularioCuenta({ cuenta, onGuardado, onCancelar }: {
  cuenta: Cuenta | null;
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const { avisar } = useAvisos();
  const [nombre, setNombre] = useState(cuenta?.nombre ?? '');
  const [tipo, setTipo] = useState(cuenta?.tipo ?? 'corriente');
  const [saldoInicial, setSaldoInicial] = useState(cuenta ? String(cuenta.saldoInicial).replace('.', ',') : '');
  const [color, setColor] = useState(cuenta?.color ?? COLORES[0]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!nombre.trim()) {
      setError('Ponle un nombre: «Banco X», «Efectivo», «Ahorro»…');
      return;
    }

    setGuardando(true);
    try {
      const datos = { nombre: nombre.trim(), tipo, saldoInicial: aNumero(saldoInicial) ?? 0, color };
      if (cuenta) {
        await apiCuentas.actualizar(cuenta.id, datos);
        avisar('Cuenta actualizada');
      } else {
        await apiCuentas.crear(datos);
        avisar('Cuenta creada');
      }
      onGuardado();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido guardar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      {error && <div className="alerta alerta--error">{error}</div>}

      <Campo etiqueta="Nombre" htmlFor="cta-nombre">
        <input
          id="cta-nombre"
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Banco X"
          maxLength={60}
          autoFocus
        />
      </Campo>

      <div className="rejilla-formulario">
        <Campo etiqueta="Tipo" htmlFor="cta-tipo">
          <select id="cta-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as Cuenta['tipo'])}>
            {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
          </select>
        </Campo>

        <Campo
          etiqueta="Saldo de partida (€)"
          ayuda="Lo que había cuando empezaste a usar la aplicación."
          htmlFor="cta-saldo"
        >
          <input
            id="cta-saldo"
            type="text"
            inputMode="decimal"
            value={saldoInicial}
            onChange={(e) => setSaldoInicial(e.target.value)}
            placeholder="0"
          />
        </Campo>
      </div>

      <Campo etiqueta="Color">
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
          {guardando ? 'Guardando…' : cuenta ? 'Guardar cambios' : 'Crear cuenta'}
        </button>
      </div>
    </form>
  );
}

function FormularioTraspaso({ cuentas, onGuardado, onCancelar }: {
  cuentas: Cuenta[];
  onGuardado: () => void;
  onCancelar: () => void;
}) {
  const { avisar } = useAvisos();
  const [fecha, setFecha] = useState(hoyISO());
  const [importe, setImporte] = useState('');
  const [origenId, setOrigenId] = useState(String(cuentas[0]?.id ?? ''));
  const [destinoId, setDestinoId] = useState(String(cuentas[1]?.id ?? ''));
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    const valor = aNumero(importe);

    if (valor === null || valor <= 0) return setError('Escribe cuánto mueves');
    if (origenId === destinoId) return setError('El origen y el destino no pueden ser la misma cuenta');

    setGuardando(true);
    try {
      await apiCuentas.crearTraspaso({
        fecha,
        importe: valor,
        origenId: Number(origenId),
        destinoId: Number(destinoId),
        descripcion: descripcion.trim(),
      });
      avisar('Traspaso registrado');
      onGuardado();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido registrar');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      {error && <div className="alerta alerta--error">{error}</div>}

      <div className="alerta alerta--info">
        <div>
          Mover dinero entre cuentas tuyas <strong>no es un gasto ni un ingreso</strong>: tu patrimonio no cambia. Por
          eso los traspasos no aparecen en el resumen ni consumen presupuesto.
        </div>
      </div>

      <div className="rejilla-formulario">
        <Campo etiqueta="Desde" htmlFor="tr-origen">
          <select id="tr-origen" value={origenId} onChange={(e) => setOrigenId(e.target.value)}>
            {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({euros(c.saldo)})</option>)}
          </select>
        </Campo>

        <Campo etiqueta="Hasta" htmlFor="tr-destino">
          <select id="tr-destino" value={destinoId} onChange={(e) => setDestinoId(e.target.value)}>
            {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({euros(c.saldo)})</option>)}
          </select>
        </Campo>
      </div>

      <div className="rejilla-formulario">
        <Campo etiqueta="Importe (€)" htmlFor="tr-importe">
          <input
            id="tr-importe"
            type="text"
            inputMode="decimal"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            placeholder="500"
            autoFocus
          />
        </Campo>

        <Campo etiqueta="Fecha" htmlFor="tr-fecha">
          <input id="tr-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Campo>
      </div>

      <Campo etiqueta="Concepto" htmlFor="tr-desc">
        <input
          id="tr-desc"
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Al colchón de imprevistos"
          maxLength={200}
        />
      </Campo>

      <div className="acciones-formulario">
        <button type="button" className="boton boton--secundario" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Registrar traspaso'}
        </button>
      </div>
    </form>
  );
}

export function PaginaCuentas() {
  const { avisar } = useAvisos();
  const [editando, setEditando] = useState<Cuenta | null | undefined>(undefined);
  const [traspasando, setTraspasando] = useState(false);
  const [borrando, setBorrando] = useState<Cuenta | null>(null);

  const lista = useRecurso<ListaCuentas>(() => apiCuentas.listar(), []);
  const traspasos = useRecurso<Traspaso[]>(() => apiCuentas.traspasos(), []);

  const recargar = () => { lista.recargar(); traspasos.recargar(); };

  const confirmarBorrado = async () => {
    if (!borrando) return;
    try {
      const r = await apiCuentas.borrar(borrando.id, true);
      avisar(
        r.movimientosAfectados > 0
          ? `Cuenta borrada. ${r.movimientosAfectados} movimiento(s) han quedado sin cuenta asignada.`
          : 'Cuenta borrada'
      );
      recargar();
    } catch (e) {
      avisar(e instanceof ErrorApi ? e.textoCompleto : 'No se ha podido borrar', 'error');
    } finally {
      setBorrando(null);
    }
  };

  const cuentas = lista.datos?.cuentas ?? [];

  return (
    <>
      <header className="cabecera-pagina">
        <div>
          <h1>Cuentas</h1>
          <p className="texto-apagado">
            Dónde está tu dinero: banco, efectivo, ahorro. Mover dinero entre ellas es un traspaso, no un gasto.
          </p>
        </div>
        <div className="cabecera-pagina__acciones">
          {cuentas.length > 1 && (
            <button type="button" className="boton boton--secundario" onClick={() => setTraspasando(true)}>
              ⇄ Nuevo traspaso
            </button>
          )}
          <button type="button" className="boton" onClick={() => setEditando(null)}>+ Nueva cuenta</button>
        </div>
      </header>

      {lista.cargando && <Cargando />}
      {lista.error && <ErrorCarga mensaje={lista.error} onReintentar={lista.recargar} />}

      {lista.datos && (
        <>
          <section className="rejilla-indicadores">
            <div className="indicador indicador--acento">
              <span className="indicador__titulo">Tienes en total</span>
              <strong className="indicador__valor">{euros(lista.datos.total)}</strong>
              <span className="indicador__detalle">Suma de todas tus cuentas</span>
            </div>
            {cuentas.map((c) => (
              <div key={c.id} className="indicador" style={{ borderLeftColor: c.color }}>
                <span className="indicador__titulo">{c.nombre}</span>
                <strong className={`indicador__valor ${c.saldo < 0 ? 'es-gasto' : ''}`}>{euros(c.saldo)}</strong>
                <span className="indicador__detalle">{c.tipoEtiqueta} · {c.movimientos} movimientos</span>
              </div>
            ))}
          </section>

          <section className="tarjeta">
            <h2 className="titulo-seccion">Tus cuentas</h2>

            {cuentas.length === 0 ? (
              <Vacio
                titulo="Aún no tienes cuentas"
                texto="Crea una por cada sitio donde tengas dinero: el banco, la hucha, la cuenta de ahorro."
                accion={<button type="button" className="boton" onClick={() => setEditando(null)}>+ Nueva cuenta</button>}
              />
            ) : (
              <div className="tabla-envoltorio">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Cuenta</th>
                      <th>Tipo</th>
                      <th className="a-derecha">Saldo de partida</th>
                      <th className="a-derecha">Movimientos</th>
                      <th className="a-derecha">Saldo actual</th>
                      <th aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {cuentas.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <span className="punto-color" style={{ backgroundColor: c.color }} />
                          <strong>{c.nombre}</strong>
                        </td>
                        <td>{c.tipoEtiqueta}</td>
                        <td className="a-derecha importe">{euros(c.saldoInicial)}</td>
                        <td className="a-derecha">{c.movimientos}</td>
                        <td className={`a-derecha importe ${c.saldo < 0 ? 'es-gasto' : 'es-ingreso'}`}>
                          {euros(c.saldo)}
                        </td>
                        <td className="a-derecha celda-acciones">
                          <button type="button" className="boton boton--texto" onClick={() => setEditando(c)}>Editar</button>
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

            <p className="nota">
              El saldo actual se calcula solo: saldo de partida, más lo que has ingresado, menos lo que has gastado,
              más y menos los traspasos. No se guarda en ningún sitio, así que nunca se desincroniza.
            </p>
          </section>

          {traspasos.datos && traspasos.datos.length > 0 && (
            <section className="tarjeta">
              <h2 className="titulo-seccion">Últimos traspasos</h2>
              <div className="tabla-envoltorio">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Concepto</th>
                      <th>De</th>
                      <th>A</th>
                      <th className="a-derecha">Importe</th>
                      <th aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {traspasos.datos.map((t) => (
                      <tr key={t.id}>
                        <td className="celda-fecha">{fechaLegible(t.fecha)}</td>
                        <td>{t.descripcion || <span className="texto-apagado">Sin concepto</span>}</td>
                        <td>
                          <span className="punto-color" style={{ backgroundColor: t.origen.color }} />
                          {t.origen.nombre}
                        </td>
                        <td>
                          <span className="punto-color" style={{ backgroundColor: t.destino.color }} />
                          {t.destino.nombre}
                        </td>
                        <td className="a-derecha importe">{euros(t.importe)}</td>
                        <td className="a-derecha">
                          <button
                            type="button"
                            className="boton boton--texto boton--peligro-texto"
                            onClick={async () => {
                              await apiCuentas.borrarTraspaso(t.id);
                              avisar('Traspaso eliminado');
                              recargar();
                            }}
                          >
                            Borrar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="nota">
                Los traspasos no aparecen en Movimientos ni en el Resumen: no son ingresos ni gastos.
              </p>
            </section>
          )}
        </>
      )}

      <Modal
        titulo={editando ? `Editar ${editando.nombre}` : 'Nueva cuenta'}
        abierto={editando !== undefined}
        onCerrar={() => setEditando(undefined)}
      >
        <FormularioCuenta
          cuenta={editando ?? null}
          onGuardado={() => { setEditando(undefined); recargar(); }}
          onCancelar={() => setEditando(undefined)}
        />
      </Modal>

      <Modal titulo="Nuevo traspaso" abierto={traspasando} onCerrar={() => setTraspasando(false)}>
        <FormularioTraspaso
          cuentas={cuentas}
          onGuardado={() => { setTraspasando(false); recargar(); }}
          onCancelar={() => setTraspasando(false)}
        />
      </Modal>

      <Confirmacion
        abierto={borrando !== null}
        titulo="Borrar cuenta"
        mensaje={
          borrando && (
            <>
              <p>Vas a borrar <strong>{borrando.nombre}</strong>.</p>
              {borrando.movimientos > 0 && (
                <p className="alerta alerta--aviso">
                  Tiene {borrando.movimientos} movimiento(s). <strong>No se borrarán</strong>, pero quedarán sin
                  cuenta asignada. Sus traspasos sí se eliminan.
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
