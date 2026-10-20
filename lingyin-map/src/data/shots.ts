export type Shot = {
  id: string;
  index: number;
  name: string;
  en: string;
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
};

export const SHOTS: Shot[] = [
  {
    id: 'gate',
    index: 1,
    name: '山門',
    en: 'THE GATE',
    pos: [0, 8.4, 70],
    target: [0, 9.2, -8],
    fov: 38,
  },
  {
    id: 'hall',
    index: 2,
    name: '大雄寶殿',
    en: 'MAIN HALL',
    pos: [16, 5.5, 28],
    target: [-2, 9, -8],
    fov: 46,
  },
  {
    id: 'court',
    index: 3,
    name: '庭院',
    en: 'COURTYARD',
    pos: [22, 5.2, 32],
    target: [-12, 9, 8],
    fov: 44,
  },
  {
    id: 'aerial',
    index: 4,
    name: '遠眺',
    en: 'THE VALLEY',
    pos: [30, 42, 92],
    target: [-2, 7, -12],
    fov: 38,
  },
];
