import {
  ArcElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale,
  LineElement, PointElement, Tooltip,
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import type { DesgloseCategoria, PuntoEvolucion } from '../tipos';
import { euros, eurosCompacto } from '../utiles/formato';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Filler, Tooltip, Legend);

const COLOR_INGRESO = '#16a34a';
const COLOR_GASTO = '#dc2626';
const COLOR_BALANCE = '#2563eb';

/** Evolución mensual de ingresos, gastos y balance. */
export function GraficoEvolucion({ datos }: { datos: PuntoEvolucion[] }) {
  const serie = (etiqueta: string, campo: keyof PuntoEvolucion, color: string, relleno = false) => ({
    label: etiqueta,
    data: datos.map((d) => d[campo] as number),
    borderColor: color,
    backgroundColor: relleno ? `${color}1a` : color,
    fill: relleno,
    tension: 0.3,
    pointRadius: 3,
    pointHoverRadius: 6,
    borderWidth: 2,
  });

  return (
    <div className="grafico grafico--alto">
      <Line
        data={{
          labels: datos.map((d) => d.etiqueta),
          datasets: [
            serie('Ingresos', 'ingresos', COLOR_INGRESO),
            serie('Gastos', 'gastos', COLOR_GASTO),
            serie('Balance', 'balance', COLOR_BALANCE, true),
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 16 } },
            tooltip: {
              callbacks: { label: (ctx) => `${ctx.dataset.label}: ${euros(ctx.parsed.y)}` },
            },
          },
          scales: {
            y: {
              // precision: 0 evita ticks fraccionarios que se formatean todos como '0 €'.
              ticks: { precision: 0, callback: (valor) => eurosCompacto(Number(valor)) },
              suggestedMax: 100,
              grid: { color: '#e2e8f0' },
            },
            x: { grid: { display: false } },
          },
        }}
      />
    </div>
  );
}

/** Distribución por categoría (anillo). Usa el color propio de cada categoría. */
export function GraficoDistribucion({ datos, titulo }: { datos: DesgloseCategoria[]; titulo?: string }) {
  if (datos.length === 0) {
    return <p className="texto-apagado">No hay datos suficientes para el gráfico.</p>;
  }

  return (
    <div className="grafico">
      <Doughnut
        data={{
          labels: datos.map((d) => d.nombre),
          datasets: [
            {
              data: datos.map((d) => d.total),
              backgroundColor: datos.map((d) => d.color),
              borderColor: '#ffffff',
              borderWidth: 2,
              hoverOffset: 8,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: '58%',
          plugins: {
            title: titulo ? { display: true, text: titulo } : undefined,
            legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, padding: 12 } },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const punto = datos[ctx.dataIndex];
                  return `${punto.nombre}: ${euros(punto.total)} (${punto.porcentaje} %)`;
                },
              },
            },
          },
        }}
      />
    </div>
  );
}
