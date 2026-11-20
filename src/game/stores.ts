export type StoreType = 'supermarket' | 'ammu_store' | 'clothing' | 'lsc' | 'barber' | 'dispensary';

export type StoreFacing = 'N' | 'S' | 'E' | 'W';

export interface WalkInStore {
  id: string;
  name: string;
  signText: string;
  type: StoreType;
  brandColor: string;
  accentHex: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  facing: StoreFacing;
  district: string;
  description: string;
  clerkName: string;
  robbable?: boolean;
}

export interface StoreSnackItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  healthGain: number;
  specialGain: number;
}

export interface StoreOutfitItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  jacketColor?: number;
  pantsColor?: number;
  toggleAccessory?: 'sunglasses' | 'cap' | 'chain';
}

export interface StoreBarberItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  hairColor: number;
}

export interface StoreLscPaint {
  id: string;
  name: string;
  hex: number;
  css: string;
  price: number;
}

export const WALK_IN_STORES: WalkInStore[] = [
  {
    id: 'store_247_centro',
    name: '24/7 Supermarket (Centro)',
    signText: '24/7 MARKET',
    type: 'supermarket',
    brandColor: '#22c55e',
    accentHex: 0x22c55e,
    x: 100,
    z: -152,
    width: 10,
    depth: 12,
    facing: 'E',
    district: 'Centro Finanziario',
    description: 'Minimarket aperto 24 ore: snack, bevande energetiche e cassa rapinabile.',
    clerkName: 'Apu',
    robbable: true,
  },
  {
    id: 'store_247_vespucci',
    name: '24/7 Supermarket (Vespucci)',
    signText: '24/7 MARKET',
    type: 'supermarket',
    brandColor: '#22c55e',
    accentHex: 0x22c55e,
    x: -100,
    z: 540,
    width: 12,
    depth: 10,
    facing: 'S',
    district: 'Lungomare Vespucci',
    description: 'Negozio sul lungomare con bibite fresche, barrette e registratore di cassa.',
    clerkName: 'Marco C.',
    robbable: true,
  },
  {
    id: 'store_ammu_centro',
    name: 'Ammu-Nation (Centro)',
    signText: 'AMMU-NATION',
    type: 'ammu_store',
    brandColor: '#ef4444',
    accentHex: 0xef4444,
    x: 101,
    z: -42,
    width: 8,
    depth: 12,
    facing: 'E',
    district: 'Centro Finanziario',
    description: 'Armeria ufficiale: entra per acquistare armi, munizioni e giubbotti antiproiettile.',
    clerkName: 'Serg. Miller',
  },
  {
    id: 'store_ammu_sud',
    name: 'Ammu-Nation (Porto Sud)',
    signText: 'AMMU-NATION',
    type: 'ammu_store',
    brandColor: '#ef4444',
    accentHex: 0xef4444,
    x: -101,
    z: 315,
    width: 8,
    depth: 12,
    facing: 'W',
    district: 'Plaza del Sol',
    description: 'Armeria attrezzata vicino al Porto con rifornimento rapido e protezioni.',
    clerkName: 'Hank',
  },
  {
    id: 'store_clothes_rockford',
    name: 'Ponsonbys Boutique',
    signText: 'PONSONBYS',
    type: 'clothing',
    brandColor: '#ec4899',
    accentHex: 0xec4899,
    x: -139,
    z: -180,
    width: 8,
    depth: 12,
    facing: 'E',
    district: 'Rockford Hills',
    description: 'Boutique di alta moda: prova e cambia completi, occhiali e accessori dal vivo.',
    clerkName: 'Chloé',
  },
  {
    id: 'store_clothes_south',
    name: 'Binco Abbigliamento',
    signText: 'BINCO',
    type: 'clothing',
    brandColor: '#f472b6',
    accentHex: 0xf472b6,
    x: 139,
    z: 185,
    width: 8,
    depth: 12,
    facing: 'W',
    district: 'Plaza del Sol',
    description: 'Abbigliamento urbano, giacche streetwear, cappellini e catene d’oro.',
    clerkName: 'Elena',
  },
  {
    id: 'store_lsc_porto',
    name: 'Los Santos Customs',
    signText: 'LS CUSTOMS',
    type: 'lsc',
    brandColor: '#38bdf8',
    accentHex: 0x38bdf8,
    x: -410,
    z: 98,
    width: 14,
    depth: 12,
    facing: 'S',
    district: 'Porto Industriale',
    description: 'Entra in officina con la tua auto per riparazioni, verniciatura, turbo e azzeramento stelle.',
    clerkName: 'Meccanico LSC',
  },
  {
    id: 'store_barber_vinewood',
    name: 'Barbiere Herr Kutz',
    signText: 'HERR KUTZ',
    type: 'barber',
    brandColor: '#f59e0b',
    accentHex: 0xf59e0b,
    x: 139,
    z: -180,
    width: 8,
    depth: 12,
    facing: 'W',
    district: 'Vinewood Est',
    description: 'Salone di barbiere classico: cambia stile e colore capelli dal vivo sul tuo personaggio.',
    clerkName: 'Enzo',
  },
  {
    id: 'store_smoke_vespucci',
    name: 'Smoke on the Water Shop',
    signText: 'SMOKE WATER',
    type: 'dispensary',
    brandColor: '#10b981',
    accentHex: 0x10b981,
    x: -85,
    z: 584,
    width: 12,
    depth: 10,
    facing: 'S',
    district: 'Spiaggia di Vespucci',
    description: 'Negozio sul lungomare di Vespucci: entra per rimedi naturali che ricaricano Salute e Speciale.',
    clerkName: 'Otto',
  },
];

export const SUPERMARKET_ITEMS: StoreSnackItem[] = [
  { id: 'psqs', name: "P's & Q's Caramelle", desc: 'Snack rapido dolce', price: 15, healthGain: 20, specialGain: 5 },
  { id: 'egochaser', name: 'Barretta eGOChaser', desc: 'Energia immediata +35 Salute', price: 25, healthGain: 35, specialGain: 15 },
  { id: 'sprunk', name: 'Lattina Sprunk', desc: 'Essenza di Los Solis (+Salute/Speciale)', price: 20, healthGain: 25, specialGain: 30 },
  { id: 'ecola', name: 'eCola Ghiacciata', desc: 'Deliziosamente infettiva', price: 20, healthGain: 25, specialGain: 30 },
  { id: 'medkit', name: 'Kit Pronto Soccorso', desc: 'Ripristina subito il 100% della Salute', price: 120, healthGain: 100, specialGain: 20 },
];

export const DISPENSARY_ITEMS: StoreSnackItem[] = [
  { id: 'tisana', name: 'Tisana Rilassante', desc: 'Ricarica +45 Salute e +40 Speciale', price: 40, healthGain: 45, specialGain: 40 },
  { id: 'estratto', name: 'Estratto Botanico Gold', desc: 'Focus massimo: +70 Salute e 100% Speciale', price: 90, healthGain: 70, specialGain: 100 },
  { id: 'wellness', name: 'Pacchetto Benessere Totale', desc: 'Porta Salute e Speciale al 100%', price: 140, healthGain: 100, specialGain: 100 },
];

export const CLOTHING_ITEMS: StoreOutfitItem[] = [
  { id: 'suit_black', name: 'Completo Elegante Nero', desc: 'Stile rapinatore professionista', price: 320, jacketColor: 0x18181b, pantsColor: 0x111827 },
  { id: 'suit_white', name: 'Completo VIP Bianco', desc: 'Giacca sartoriale da attico casinò', price: 450, jacketColor: 0xe2e8f0, pantsColor: 0x334155 },
  { id: 'bomber_blue', name: 'Giacca Bomber Blu Notte', desc: 'Look streetwear per le corse', price: 260, jacketColor: 0x1d4ed8, pantsColor: 0x1e293b },
  { id: 'track_red', name: 'Tuta Sportiva Cremisi', desc: 'Giacca sportiva rossa & jeans scuri', price: 240, jacketColor: 0xdc2626, pantsColor: 0x0f172a },
  { id: 'olive_tac', name: 'Giacca Tattica Verde Oliva', desc: 'Ideale per missioni al Porto', price: 280, jacketColor: 0x3f6212, pantsColor: 0x27272a },
  { id: 'acc_glasses', name: 'Occhiali da Sole Aviator', desc: 'Metti / togli occhiali sul volto 3D', price: 90, toggleAccessory: 'sunglasses' },
  { id: 'acc_cap', name: 'Cappellino Street', desc: 'Metti / togli cappellino 3D', price: 75, toggleAccessory: 'cap' },
  { id: 'acc_chain', name: "Catena d'Oro Massiccio", desc: 'Metti / togli collana d’oro 3D', price: 180, toggleAccessory: 'chain' },
];

export const BARBER_ITEMS: StoreBarberItem[] = [
  { id: 'hair_black', name: 'Taglio Nero Corvino', desc: 'Sfumatura classica pulita', price: 70, hairColor: 0x141414 },
  { id: 'hair_brown', name: 'Castano Naturale', desc: 'Stile californiano tramonto', price: 70, hairColor: 0x4b3222 },
  { id: 'hair_blonde', name: 'Biondo Platino VIP', desc: 'Colore ossigenato Vinewood', price: 110, hairColor: 0xfde047 },
  { id: 'hair_red', name: 'Rosso Scarlatto', desc: 'Look ribelle rock', price: 110, hairColor: 0xdc2626 },
  { id: 'hair_cyan', name: 'Blu Elettrico Neon', desc: 'Tinta moderna da nightclub', price: 130, hairColor: 0x0ea5e9 },
];

export const LSC_PAINTS: StoreLscPaint[] = [
  { id: 'red', name: 'Rosso Corsa', hex: 0xe11d48, css: '#e11d48', price: 200 },
  { id: 'blue', name: 'Blu Elettrico', hex: 0x0284c7, css: '#0284c7', price: 200 },
  { id: 'gold', name: 'Oro Solis', hex: 0xf59e0b, css: '#f59e0b', price: 320 },
  { id: 'matte', name: 'Nero Opaco', hex: 0x181a1f, css: '#181a1f', price: 250 },
  { id: 'green', name: 'Verde Lime', hex: 0x22c55e, css: '#22c55e', price: 200 },
  { id: 'purple', name: 'Viola Casinò', hex: 0x7c3aed, css: '#7c3aed', price: 240 },
  { id: 'white', name: 'Bianco Perla', hex: 0xf8fafc, css: '#f8fafc', price: 200 },
];

export function getStoreDoorPos(store: WalkInStore): { x: number; z: number } {
  const offset = store.facing === 'E' || store.facing === 'W' ? store.width * 0.5 + 1.8 : store.depth * 0.5 + 1.8;
  switch (store.facing) {
    case 'E':
      return { x: store.x + offset, z: store.z };
    case 'W':
      return { x: store.x - offset, z: store.z };
    case 'S':
      return { x: store.x, z: store.z + offset };
    case 'N':
      return { x: store.x, z: store.z - offset };
  }
}

export function getStoreCounterPos(store: WalkInStore): { x: number; z: number } {
  // Counter sits toward the back wall opposite the entrance
  const offset = store.facing === 'E' || store.facing === 'W' ? store.width * 0.16 : store.depth * 0.16;
  switch (store.facing) {
    case 'E':
      return { x: store.x - offset, z: store.z };
    case 'W':
      return { x: store.x + offset, z: store.z };
    case 'S':
      return { x: store.x, z: store.z - offset };
    case 'N':
      return { x: store.x, z: store.z + offset };
  }
}
