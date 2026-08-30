# Referencias España — consultadas en agosto de 2026

Cifras macro sobre las que se calibran las recomendaciones de la aplicación. **Caducan**:
el IPC y el euríbor se publican cada mes. Al actualizarlas hay que tocar también
`server/src/servicios/referencias.js` y anotar aquí la nueva fecha.

## Inflación

| Indicador | Valor | Fecha |
| --- | --- | --- |
| IPC interanual | **4,3 %** (dato adelantado) | Agosto 2026 |
| IPC julio | 3,6 % | Julio 2026 |
| Inflación subyacente | **2,9 %** | Agosto 2026 |

El 4,3 % es el nivel más alto desde febrero de 2023 y lo empujan sobre todo los
**carburantes**. Que la subyacente esté en el 2,9 % dice que no es una subida
generalizada: es energía. Por eso el perfil de renta ajustada sube el rango de
Transporte y no el de todas las partidas.

Dato definitivo del INE: 15 de septiembre de 2026.

## Carburantes

| Producto | Precio medio |
| --- | --- |
| Gasolina 95 | ~1,72 €/l |
| Diésel | ~1,82 – 1,86 €/l |

## Euríbor e hipotecas

| Indicador | Valor |
| --- | --- |
| Euríbor 12 meses, media de agosto 2026 | **~2,95 %** |
| Euríbor agosto 2025 | 2,11 % |
| Diferencia interanual | **+0,84 puntos** |

Impacto en una hipoteca variable de 175.000 € a 30 años con diferencial +0,608 % que
revise en septiembre: **unos +78 €/mes**. Para una nómina de 1.600 € eso sería casi un
5 % del neto de golpe.

## Estructura del gasto de los hogares (INE, EPF 2024)

| Partida | % del gasto total del hogar |
| --- | --- |
| Vivienda, agua, electricidad, gas y combustibles | **33,2 %** |
| Alimentación | **16 %** |
| Transporte | **11,5 %** |
| Restaurantes y alojamientos | **9,3 %** |

Vivienda + alimentación + transporte concentran el **60 %** del presupuesto familiar.

**Dato que justifica el perfil de renta ajustada:** en los hogares de menor gasto la
vivienda supone el **41,9 %** del presupuesto, frente al **28,9 %** en los de mayor gasto.
Es la ley de Engel medida: cuanto menor es la renta, más pesan los gastos que no se
pueden comprimir.

> Ojo al comparar: estos porcentajes son sobre el **gasto** total del hogar, no sobre los
> ingresos. No son sumables con los rangos recomendados de la aplicación.

## Ahorro de los hogares

| Indicador | Valor |
| --- | --- |
| Tasa de ahorro sobre renta disponible | **12 %** (2025) |

Es siete décimas menos que en 2024 y el nivel más bajo desde 2023. Sirve como contexto,
no como objetivo.

## Vivienda

| Referencia | Valor |
| --- | --- |
| Precio medio nacional | 2.357 – 2.823 €/m² (según fuente, mediados de 2026) |
| Municipios más baratos | Jaén, Albacete, Toledo, Extremadura, Castilla-La Mancha |
| Villanueva del Arzobispo (Jaén) | 657 €/m² |
| Fuenteovejuna (Córdoba), el más barato | 369 €/m² — 100 m² por menos de 37.000 € |
| Entrada habitual | 20 % del precio |
| Gastos de compraventa | 8–12 % según comunidad (ITP, notaría, registro) |

## Fiscalidad de autónomos (consultado el 30/08/2026)

| Concepto | Regla |
| --- | --- |
| Suministros de la vivienda | **30 % sobre la parte proporcional afecta**, no sobre la factura. Hay que haber declarado el % de superficie en el 036/037. |
| Dietas de manutención | 26,67 €/día en España, 48,08 € en el extranjero. Se duplican con pernocta (53,34 / 96,16). **En restaurante y pagado por medio electrónico.** |
| Vehículo turismo | IRPF: no deducible salvo afectación exclusiva. IVA: **50 % por presunción legal**. Excepción de taxis, transportistas, autoescuelas y comerciales. |
| Seguro médico privado | Hasta 500 €/año por persona (1.500 € con discapacidad). |
| Gastos de difícil justificación | 5 % del rendimiento neto, **tope 2.000 €/año**, solo en estimación directa simplificada. |
| Elementos por debajo de 300 € | Deducibles de golpe, sin amortizar, con límite anual. |

**Lo más fiscalizado**, según el Plan Anual de Control Tributario de la AEAT: gastos de
**vehículo y dietas** deducidos sin justificación suficiente.

### TRADE (autónomo económicamente dependiente)

Más del **75 %** de los ingresos de un mismo cliente, sin trabajadores a cargo, sin
externalizar, con medios propios, retribución variable, sin local abierto al público y
cotizando por contingencias profesionales. Contrato por escrito registrado en el **SEPE**.

Derechos: **18 días hábiles de vacaciones** mínimo, indemnización si el cliente extingue
sin causa, y acuerdos de interés profesional.

Cuidado con la frontera del **falso autónomo**: horario impuesto, medios del cliente y
órdenes directas pueden convertir la relación en laboral encubierta, con sanciones y
regularización de cuotas.

### Cuota RETA 2026

Prorrogada desde 2025: 15 tramos según rendimientos netos, tabla reducida hasta 1.700 €.
**Tarifa plana de 80 €/mes** los primeros 12 meses, prorrogables otros 12 si los
rendimientos quedan bajo el SMI. Las fuentes públicas **discrepan en los extremos**
(200 frente a 230 € de mínima; 590 frente a 604,8 € de máxima), por lo que la aplicación
no incluye la tabla y pide la cuota real al usuario.

## Fuentes

- [IPC agosto 2026 (dato adelantado)](https://www.moncloa.com/2026/08/28/inflacion-agosto-espana-4-3-bce-3422402/)
- [INE — tabla de IPC](https://www.ine.es/prensa/ipc_tabla.htm)
- [Precio de los carburantes, agosto 2026](https://ahorrogasolina.es/blog/precio-gasolina-espana-agosto-2026)
- [Euríbor diario](https://www.euribordiario.es/)
- [Impacto del euríbor en la cuota hipotecaria](https://www.merca2.es/2026/08/19/euribor-agosto-2026-subida-hipoteca-2-2438281/)
- [INE — Encuesta de Presupuestos Familiares 2024](https://www.ine.es/dyngs/Prensa/EPF2024.htm)
- [Reparto del gasto de las familias españolas](https://www.laregion.es/economia/vivienda-comida-mitad-gasto-familias-espanolas_1_20260625-4330159.html)
- [Tasa de ahorro de los hogares, 2025](https://www.infobae.com/america/agencias/2026/04/01/la-tasa-de-ahorro-de-los-hogares-baja-al-12-en-2025-tras-disparar-su-gasto-en-consumo-un-62/)
- [Precio de la vivienda en España 2026](https://www.tinsa.es/precio-vivienda/)
- [AEAT — gastos deducibles en estimación directa](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2024/c07-rendimientos-actividades-economicas-estimacion-directa/fase-1-determinacion-rendimiento-neto/gastos-fiscalmente-deducibles/servicios-exteriores/suministros.html)
- [AEAT — novedades de la Ley 6/2017 (suministros y manutención)](https://sede.agenciatributaria.gob.es/Sede/irpf/novedades-impuesto/novedades-normativa/principales-novedades-tributarias-introducidas-ley-6_2017.html)
- [Cuota de autónomos 2026 y tramos](https://www.infoautonomos.com/seguridad-social/cuota-de-autonomos-cuanto-se-paga/)
- [Autónomo TRADE: requisitos y derechos](https://declarando.es/autonomo-dependiente-trade)
- [Gastos deducibles del autónomo en el IRPF](https://www.infoautonomos.com/fiscalidad/gastos-deducibles-autonomos-irpf-estimacion-directa/)
