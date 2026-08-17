// Seis estancias. Un gesto: encenderlas.
//
// `off` y `on` son la MISMA imagen en dos estados. Tienen que estar alineadas
// al píxel — por eso se generan como edición de la primera, no como dos
// imágenes independientes.

export const rooms = [
  {
    id: 'umbral',
    num: '01',
    label: 'Umbral',
    line: 'Antes de entrar, ya te reconoce.',
  },
  {
    id: 'salon',
    num: '02',
    label: 'Salón',
    line: 'Bájala. Ahora quédate.',
  },
  {
    id: 'cocina',
    num: '03',
    label: 'Cocina',
    line: 'Aquí la luz trabaja.',
  },
  {
    id: 'pasillo',
    num: '04',
    label: 'Pasillo',
    line: 'Lo justo para no encender nada.',
  },
  {
    id: 'dormitorio',
    num: '05',
    label: 'Dormitorio',
    line: 'La última que se apaga.',
  },
  {
    id: 'jardin',
    num: '06',
    label: 'Jardín',
    line: 'Y la casa se ve desde fuera.',
  },
].map((r) => ({
  ...r,
  off: `/rooms/${r.id}-off.jpg`,
  on: `/rooms/${r.id}-on.jpg`,
}));
