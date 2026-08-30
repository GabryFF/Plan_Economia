import { MESES } from '../utiles/formato';

interface Props {
  anio: number;
  mes: number;
  onCambiar: (anio: number, mes: number) => void;
}

/** Navegación mes a mes con flechas: el patrón que todo el mundo entiende. */
export function SelectorPeriodo({ anio, mes, onCambiar }: Props) {
  const mover = (delta: number) => {
    const fecha = new Date(anio, mes - 1 + delta, 1);
    onCambiar(fecha.getFullYear(), fecha.getMonth() + 1);
  };

  const hoy = new Date();
  const esMesActual = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1;

  return (
    <div className="selector-periodo">
      <button type="button" className="boton boton--icono" onClick={() => mover(-1)} aria-label="Mes anterior">
        ‹
      </button>
      <select
        value={mes}
        onChange={(e) => onCambiar(anio, Number(e.target.value))}
        aria-label="Mes"
      >
        {MESES.map((nombre, indice) => (
          <option key={nombre} value={indice + 1}>{nombre}</option>
        ))}
      </select>
      <select value={anio} onChange={(e) => onCambiar(Number(e.target.value), mes)} aria-label="Año">
        {Array.from({ length: 11 }, (_, i) => hoy.getFullYear() - 5 + i).map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>
      <button type="button" className="boton boton--icono" onClick={() => mover(1)} aria-label="Mes siguiente">
        ›
      </button>
      {!esMesActual && (
        <button
          type="button"
          className="boton boton--texto"
          onClick={() => onCambiar(hoy.getFullYear(), hoy.getMonth() + 1)}
        >
          Ir a hoy
        </button>
      )}
    </div>
  );
}
