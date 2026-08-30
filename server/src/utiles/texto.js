/**
 * Normalización de texto para comparar descripciones con patrones.
 *
 * Los conceptos bancarios llegan en mayúsculas, con tildes inconsistentes y
 * espacios de relleno ("COMPRA   MERCADONA  MADRID"). Comparar en crudo
 * obligaría al usuario a clavar el patrón carácter a carácter.
 */
export function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
