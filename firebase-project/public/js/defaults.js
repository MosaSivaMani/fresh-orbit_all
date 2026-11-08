// Starting catalogue and shop settings.
// The live site reads these from Firestore; this file is the fallback
// (and what "Load starting catalog" copies into Firestore the first time).

export const CATS = [
  { id: 'all', en: 'All', te: 'అన్నీ' },
  { id: 'fish', en: 'Fish', te: 'చేపలు' },
  { id: 'prawn', en: 'Prawns & Crab', te: 'రొయ్యలు' },
  { id: 'chicken', en: 'Chicken', te: 'చికెన్' },
  { id: 'mutton', en: 'Mutton', te: 'మటన్' }
];

const FISH_W = [0.5, 1, 1.5, 2];
const PRAWN_W = [0.25, 0.5, 1, 2];
const MEAT_W = [0.5, 1, 1.5, 2];

export const DEFAULT_SETTINGS = {
  whatsapp: '918498857618',
  upi: '8498857618@ybl',
  open: true,
  banner: 'ఈరోజు పులస వచ్చింది! · Pulasa arrived today',
  freeAbove: 999,
  minOrder: 300,
  hours: '7 AM – 9 PM',
  slots: ['7 – 10 AM', '12 – 3 PM', '5 – 8 PM'],
  areas: [
    { name: 'Ramanayyapeta', fee: 20 }, { name: 'Suryaraopeta', fee: 30 },
    { name: 'Jagannaickpur', fee: 30 }, { name: 'Gandhinagar', fee: 30 },
    { name: 'Bhanugudi', fee: 30 }, { name: 'Ramaraopeta', fee: 30 },
    { name: 'Sarpavaram', fee: 40 }, { name: 'Kondayapalem', fee: 40 },
    { name: 'Turangi', fee: 50 }, { name: 'Madhavapatnam', fee: 50 },
    { name: 'Vakalapudi', fee: 50 }, { name: 'Other area in Kakinada', fee: 60 }
  ]
};

export const DEFAULT_PRODUCTS = [
  { id: 'seer', cat: 'fish', en: 'Seer Fish', te: 'కోనెం', price: 1700, img: 'img/seer.jpg', best: true, cuts: ['Slices', 'Whole'], weights: FISH_W },
  { id: 'wpom', cat: 'fish', en: 'White Pomfret', te: 'తెల్ల చందువ', price: 900, img: 'img/whitepomfret.jpg', cuts: ['Cleaned', 'Whole'], weights: FISH_W },
  { id: 'bpom', cat: 'fish', en: 'Black Pomfret', te: 'నల్ల చందువ', price: 650, img: 'img/blackpomfret.jpg', hero: 'img/hero_pomfret.jpg', desc: 'Firm and rich. Great for tawa fry.', cuts: ['Cleaned', 'Whole'], weights: FISH_W, featured: true },
  { id: 'bass', cat: 'fish', en: 'Sea Bass', te: 'పండుగప్ప', price: 750, img: 'img/seabass.jpg', cuts: ['Cleaned', 'Whole'], weights: FISH_W },
  { id: 'mack', cat: 'fish', en: 'Mackerel', te: 'కనగడత', price: 280, img: 'img/mackerel.jpg', cuts: ['Cleaned', 'Whole'], weights: FISH_W },
  { id: 'tiger', cat: 'prawn', en: 'Tiger Prawns', te: 'టైగర్ రొయ్యలు', price: 850, img: 'img/tigerprawns.jpg', best: true, cuts: ['Cleaned & deveined', 'Whole'], weights: PRAWN_W },
  { id: 'prawn', cat: 'prawn', en: 'Prawns', te: 'రొయ్యలు', price: 480, img: 'img/prawns.jpg', hero: 'img/hero_prawns.jpg', desc: 'Medium size, 40 to 50 per kg.', cuts: ['Cleaned & deveined', 'Whole'], weights: PRAWN_W },
  { id: 'crab', cat: 'prawn', en: 'Mud Crab', te: 'పీతలు', price: 650, img: 'img/crab.jpg', cuts: ['Cleaned', 'Whole'], weights: FISH_W },
  { id: 'ccc', cat: 'chicken', en: 'Chicken Curry Cut', te: 'చికెన్ కర్రీ కట్', price: 260, best: true, cuts: [], weights: MEAT_W },
  { id: 'cbl', cat: 'chicken', en: 'Chicken Boneless', te: 'బోన్‌లెస్ చికెన్', price: 360, cuts: [], weights: MEAT_W },
  { id: 'mcc', cat: 'mutton', en: 'Mutton Curry Cut', te: 'మటన్ కర్రీ కట్', price: 900, best: true, cuts: [], weights: MEAT_W },
  { id: 'mbl', cat: 'mutton', en: 'Mutton Boneless', te: 'బోన్‌లెస్ మటన్', price: 1100, cuts: [], weights: MEAT_W }
].map((p, i) => ({ desc: '', best: false, img: '', hero: '', featured: false, inStock: true, order: i, ...p }));
