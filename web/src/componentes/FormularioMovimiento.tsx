import { useState, type FormEvent } from 'react';
import { ErrorApi } from '../api/cliente';
import { cuentas as apiCuentas, movimientos as apiMovimientos } from '../api/recursos';
import type { Categoria, Movimiento, Tipo } from '../tipos';
import { aNumero, hoyISO } from '../utiles/formato';
import { Campo, SelectorTipo } from './Campos';
import { useRecurso } from '../hooks/useRecurso';

interface Props {
  categorias: Categoria[];
  movimiento?: Movimiento | null;
  onGuardado: (mensaje: string) => void;
  onCancelar: () => void;
}

interface Errores {
  fecha?: string;
  importe?: string;
  descripcion?: string;
  general?: string;
}

export function FormularioMovimiento({ categorias, movimiento, onGuardado, onCancelar }: Props) {
  const [tipo, setTipo] = useState<Tipo>(movimiento?.tipo ?? 'gasto');
  const [fecha, setFecha] = useState(movimiento?.fecha ?? hoyISO());
  const [importe, setImporte] = useState(movimiento ? String(movimiento.importe).replace('.', ',') : '');
  const [descripcion, setDescripcion] = useState(movimiento?.descripcion ?? '');
  const [categoriaId, setCategoriaId] = useState<string>(movimiento?.categoriaId ? String(movimiento.categoriaId) : '');
  const [cuentaId, setCuentaId] = useState<string>(movimiento?.cuentaId ? String(movimiento.cuentaId) : '');
  const [errores, setErrores] = useState<Errores>({});

  // Con una sola cuenta el selector no aporta nada y se oculta.
  const cuentas = useRecurso(() => apiCuentas.listar(), []);
  const [guardando, setGuardando] = useState(false);

  const categoriasDelTipo = categorias.filter((c) => c.tipo === tipo && !c.archivada);

  const cambiarTipo = (nuevo: Tipo) => {
    setTipo(nuevo);
    setCategoriaId(''); // las categorías no se comparten entre ingresos y gastos
  };

  const validar = (): Errores => {
    const nuevos: Errores = {};
    const valor = aNumero(importe);

    if (!fecha) nuevos.fecha = 'Indica la fecha del movimiento';
    if (valor === null) nuevos.importe = 'Escribe un importe, por ejemplo 45,90';
    else if (valor <= 0) nuevos.importe = 'El importe debe ser mayor que 0';
    if (descripcion.length > 200) nuevos.descripcion = 'Máximo 200 caracteres';

    return nuevos;
  };

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    const nuevos = validar();
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    const datos = {
      fecha,
      importe: aNumero(importe) as number,
      descripcion: descripcion.trim(),
      tipo,
      categoriaId: categoriaId ? Number(categoriaId) : null,
      cuentaId: cuentaId ? Number(cuentaId) : null,
    };

    setGuardando(true);
    try {
      if (movimiento) {
        await apiMovimientos.actualizar(movimiento.id, datos);
        onGuardado('Movimiento actualizado');
      } else {
        await apiMovimientos.crear(datos);
        onGuardado('Movimiento guardado');
      }
    } catch (error) {
      setErrores({ general: error instanceof ErrorApi ? error.textoCompleto : 'No se ha podido guardar' });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      {errores.general && <div className="alerta alerta--error">{errores.general}</div>}

      <Campo etiqueta="¿Qué tipo de movimiento es?">
        <SelectorTipo valor={tipo} onCambiar={cambiarTipo} />
      </Campo>

      <div className="rejilla-formulario">
        <Campo etiqueta="Fecha" error={errores.fecha} htmlFor="mov-fecha">
          <input id="mov-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </Campo>

        <Campo etiqueta="Importe (€)" error={errores.importe} ayuda="Siempre en positivo" htmlFor="mov-importe">
          <input
            id="mov-importe"
            type="text"
            inputMode="decimal"
            placeholder="45,90"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            autoFocus
          />
        </Campo>
      </div>

      <Campo etiqueta="Categoría" htmlFor="mov-categoria" ayuda={categoriasDelTipo.length === 0 ? 'No hay categorías de este tipo todavía' : undefined}>
        <select id="mov-categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">Sin categoría</option>
          {categoriasDelTipo.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </Campo>

      {(cuentas.datos?.cuentas.length ?? 0) > 1 && (
        <Campo etiqueta="¿De qué cuenta sale o entra?" htmlFor="mov-cuenta">
          <select id="mov-cuenta" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            <option value="">Sin especificar</option>
            {(cuentas.datos?.cuentas ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </Campo>
      )}

      <Campo etiqueta="Descripción" error={errores.descripcion} ayuda="Opcional. Te ayudará a reconocerlo después." htmlFor="mov-desc">
        <input
          id="mov-desc"
          type="text"
          placeholder="Compra semanal, cena con amigos…"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          maxLength={200}
        />
      </Campo>

      <div className="acciones-formulario">
        <button type="button" className="boton boton--secundario" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="boton" disabled={guardando}>
          {guardando ? 'Guardando…' : movimiento ? 'Guardar cambios' : 'Añadir movimiento'}
        </button>
      </div>
    </form>
  );
}
