/**
 * ============================================================================
 * नेपाली युनिकोड रूपान्तरण इन्जिन (Nepali Unicode Engine)
 * Supports:
 * 1. Nepali Unicode Romanized (ध्वन्यात्मक / Phonetic Romanized)
 * 2. Nepali Unicode Traditional (परम्परागत / Preeti-style Devanagari Unicode Layout)
 * 3. Standard Numerals & Punctuation Converter
 * ============================================================================
 */

export type KeyboardLayoutMode = 'romanized' | 'traditional' | 'english';

// ----------------------------------------------------------------------------
// १. अंक तथा विराम चिह्न म्यापिङ (Numerals & Punctuation)
// ----------------------------------------------------------------------------
export const NEPALI_NUMERALS: Record<string, string> = {
  '0': '०',
  '1': '१',
  '2': '२',
  '3': '३',
  '4': '४',
  '5': '५',
  '6': '६',
  '7': '७',
  '8': '८',
  '9': '९',
};

export const ENGLISH_NUMERALS: Record<string, string> = {
  '०': '0',
  '१': '1',
  '२': '2',
  '३': '3',
  '४': '4',
  '५': '5',
  '६': '6',
  '७': '7',
  '८': '8',
  '९': '9',
};

// ----------------------------------------------------------------------------
// २. नेपाली युनिकोड ट्रेडिसनल म्यापिङ (Traditional / Preeti Layout to Unicode)
// ----------------------------------------------------------------------------
export const TRADITIONAL_UNICODE_MAP: Record<string, string> = {
  // Lowercase letters
  a: 'ब',
  b: 'द',
  c: 'अ',
  d: 'म',
  e: 'भ',
  f: 'ा',
  g: 'न',
  h: 'ज',
  i: 'ष',
  j: 'र',
  k: 'ा',
  l: 'त',
  m: 'प',
  n: 'ल',
  o: 'य',
  p: 'उ',
  q: 'त्र',
  r: 'च',
  s: 'क',
  t: 'त',
  u: 'ग',
  v: 'ख',
  w: 'ध',
  x: 'ह',
  y: 'थ',
  z: 'श',

  // Uppercase letters (Shift + Key)
  A: 'ब्',
  B: 'द्',
  C: 'ऋ',
  D: 'म्',
  E: 'भ्',
  F: 'ँ',
  G: 'न्',
  H: 'ज्',
  I: 'क्ष',
  J: '्र',
  K: 'ी',
  L: 'थ',
  M: 'फ',
  N: 'ल्',
  O: 'इ',
  P: 'ए',
  Q: 'त्त',
  R: 'च्',
  S: 'क्',
  T: 'त्',
  U: 'ग्',
  V: 'ख्',
  W: 'ध्',
  X: 'ह्',
  Y: 'थ्',
  Z: 'श्',

  // Numbers (0-9)
  '0': '०',
  '1': '१',
  '2': '२',
  '3': '३',
  '4': '४',
  '5': '५',
  '6': '६',
  '7': '७',
  '8': '८',
  '9': '९',

  // Shift + Number Symbols
  '!': 'ज्ञ',
  '@': 'द्ध',
  '#': 'घ',
  $: 'द्व',
  '%': 'फ',
  '^': 'ट',
  '&': 'ठ',
  '*': 'ड',
  '(': 'ढ',
  ')': 'ण',

  // Punctuation & Special Keys
  '[': 'ृ',
  '{': 'र्',
  ']': 'े',
  '}': 'ै',
  ';': 'स',
  ':': 'स्',
  "'": 'ु',
  '"': 'ू',
  ',': ',',
  '<': '?',
  '.': '।',
  '>': 'श्र',
  '/': '्',
  '?': 'रु',
  '\\': '्',
  '|': '।',
  '-': '-',
  _: 'ङ',
  '=': '=',
  '+': 'ं',
  '`': 'ऽ',
  '~': 'ॐ',
};

/**
 * Transliterates a single character or string in Nepali Traditional (Preeti-to-Unicode) mode
 */
export function transliterateTraditionalChar(char: string): string {
  if (TRADITIONAL_UNICODE_MAP[char] !== undefined) {
    return TRADITIONAL_UNICODE_MAP[char];
  }
  return char;
}

export function transliterateTraditionalString(input: string): string {
  if (!input) return '';
  let result = '';
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    result += TRADITIONAL_UNICODE_MAP[char] !== undefined ? TRADITIONAL_UNICODE_MAP[char] : char;
  }
  return result;
}

// ----------------------------------------------------------------------------
// ३. नेपाली युनिकोड रोमनाइज्ड शब्दकोश (Romanized Instant Words)
// ----------------------------------------------------------------------------
export const COMMON_NEPALI_WORDS: Record<string, string> = {
  nepal: 'नेपाल',
  nepali: 'नेपाली',
  sarkar: 'सरकार',
  mantralaya: 'मन्त्रालय',
  bibhag: 'विभाग',
  vibhag: 'विभाग',
  karyalaya: 'कार्यालय',
  nideshanalaya: 'निर्देशनालय',
  nirdeshanalaya: 'निर्देशनालय',
  shakha: 'शाखा',
  prashasan: 'प्रशासन',
  prasasan: 'प्रशासन',
  lekhapal: 'लेखापाल',
  lekha: 'लेखा',
  adhikrit: 'अधिकृत',
  sahayak: 'सहायक',
  pramukh: 'प्रमुख',
  hakim: 'हाकिम',
  karmachari: 'कर्मचारी',
  sewa: 'सेवा',
  shreni: 'श्रेणी',
  taha: 'तह',
  pad: 'पद',
  thegana: 'ठेगाना',
  jilla: 'जिल्ला',
  pradesh: 'प्रदेश',
  sthaniya: 'स्थानीय',
  palika: 'पालिका',
  nagarpalika: 'नगरपालिका',
  gaunpalika: 'गाउँपालिका',
  mahanagarpalika: 'महानगरपालिका',
  upmahanagarpalika: 'उपमहानगरपालिका',
  ward: 'वडा',
  tole: 'टोल',
  sadak: 'सडक',
  swasthya: 'स्वास्थ्य',
  siksha: 'शिक्षा',
  shiksha: 'शिक्षा',
  krishi: 'कृषि',
  ban: 'वन',
  bikas: 'विकास',
  rastriya: 'राष्ट्रिय',
  rashtriya: 'राष्ट्रिय',
  banijya: 'वाणिज्य',
  bank: 'बैंक',
  talab: 'तलब',
  bhatta: 'भत्ता',
  poshak: 'पोशाक',
  mahangi: 'महंगी',
  durgam: 'दुर्गम',
  protsahan: 'प्रोत्साहन',
  chadparwa: 'चाडपर्व',
  kharcha: 'खर्च',
  dashain: 'दशैं',
  tihar: 'तिहार',
  katti: 'कट्टी',
  bima: 'बिमा',
  beema: 'बिमा',
  sanchayakosh: 'सञ्चयकोष',
  sanchaya: 'सञ्चय',
  kosh: 'कोष',
  nibrittibharan: 'निवृत्तिभरण',
  pension: 'पेन्सन',
  upadan: 'उपदान',
  nagarik: 'नागरिक',
  lagani: 'लगानी',
  trust: 'ट्रस्ट',
  kar: 'कर',
  chhut: 'छुट',
  shrawan: 'श्रावण',
  srawan: 'साउन',
  bhadra: 'भाद्र',
  bhadau: 'भदौ',
  ashwin: 'असोज',
  asoj: 'असोज',
  kartik: 'कार्तिक',
  mangsir: 'मंसिर',
  mangsir1: 'मंसिर',
  poush: 'पुष',
  pus: 'पुष',
  magh: 'माघ',
  falgun: 'फागुन',
  chaitra: 'चैत',
  chait: 'चैत',
  baishakh: 'बैशाख',
  jestha: 'जेठ',
  jeth: 'जेठ',
  ashadh: 'असार',
  asar: 'असार',
  kaifiyat: 'कैफियत',
  bibaran: 'विवरण',
  namaste: 'नमस्ते',
  namaskar: 'नमस्कार',
  ram: 'राम',
  shyam: 'श्याम',
  syam: 'श्याम',
  hari: 'हरि',
  krishna: 'कृष्ण',
  sharma: 'शर्मा',
  adhikari: 'अधिकारी',
  bhattarai: 'भट्टराई',
  pokhrel: 'पोखरेल',
  thapa: 'थापा',
  koirala: 'कोइराला',
  shrestha: 'श्रेष्ठ',
  paudel: 'पौडेल',
  poudel: 'पौडेल',
  prasad: 'प्रसाद',
  kumar: 'कुमार',
  kumari: 'कुमारी',
  bahadur: 'बहादुर',
  singh: 'सिंह',
  khadka: 'खड्का',
  dahal: 'दाहाल',
  subedi: 'सुवेदी',
  pandey: 'पाण्डेय',
  upadhyaya: 'उपाध्याय',
  acharya: 'आचार्य',
  regmi: 'रेग्मी',
  giri: 'गिरी',
  puri: 'पुरी',
  magar: 'मगर',
  gurung: 'गुरुङ',
  rai: 'राई',
  limbu: 'लिम्बु',
  tamang: 'तामाङ',
  newar: 'नेवार',
  yadav: 'यादव',
  shah: 'शाह',
  bhandari: 'भण्डारी',
  karki: 'कार्की',
  basnet: 'बस्नेत',
  rokaya: 'रोकाया',
  rawat: 'रावत',
  bista: 'बिष्ट',
  rawal: 'रावल',
  chhetri: 'क्षेत्री',
  brahman: 'ब्राह्मण',
  sita: 'सीता',
  gita: 'गीता',
  rita: 'रीता',
  laxmi: 'लक्ष्मी',
  lakshmi: 'लक्ष्मी',
  saraswati: 'सरस्वती',
  durga: 'दुर्गा',
  maya: 'माया',
  shanti: 'शान्ति',
  devi: 'देवी',
  nepalgunj: 'नेपालगञ्ज',
  kathmandu: 'काठमाडौँ',
  lalitpur: 'ललितपुर',
  bhaktapur: 'भक्तपुर',
  pokhara: 'पोखरा',
  biratnagar: 'विराटनगर',
  birgunj: 'वीरगञ्ज',
  dhangadhi: 'धनगढी',
  butwal: 'बुटवल',
  hetauda: 'हेटौँडा',
  dharan: 'धरान',
  itahari: 'इटहरी',
  surkhet: 'सुर्खेत',
  baglung: 'बागलुङ',
  palpa: 'पाल्पा',
  chitwan: 'चितवन',
  jhapa: 'झापा',
  morang: 'मोरङ',
  sunsari: 'सुनसरी',
  kaski: 'कास्की',
  rupandehi: 'रुपन्देही',
  kailali: 'कैलाली',
  kanchanpur: 'कञ्चनपुर',
  dang: 'दाङ',
  banke: 'बाँके',
  bardiya: 'बर्दिया',
  sindhupalchok: 'सिन्धुपाल्चोक',
  kavre: 'काभ्रे',
  nuwakot: 'नुवाकोट',
  dhading: 'धादिङ',
  makwanpur: 'मकवानपुर',
  gorkha: 'गोरखा',
  tanahun: 'तनहुँ',
  syangja: 'स्याङ्जा',
  lamjung: 'लमजुङ',
  nawalparasi: 'नवलपरासी',
  kapilvastu: 'कपिलवस्तु',
  arghakhanchi: 'अर्घाखाँची',
  gulmi: 'गुल्मी',
  parbat: 'पर्वत',
  myagdi: 'म्याग्दी',
  mustang: 'मुस्ताङ',
  manang: 'मनाङ',
  pyuthan: 'प्युठान',
  rolpa: 'रोल्पा',
  rukum: 'रुकुम',
  salyan: 'सल्यान',
  dolpa: 'डोल्पा',
  jumla: 'जुम्ला',
  kalikot: 'कालिकोट',
  mugu: 'मुगु',
  humla: 'हुम्ला',
  jajarkot: 'जाजरकोट',
  dailekh: 'दैलेख',
  achham: 'अछाम',
  doti: 'डोटी',
  bajhang: 'बझाङ',
  bajura: 'बाजुरा',
  baitadi: 'बैतडी',
  darchula: 'दार्चुला',
  dadeldhura: 'डडेलधुरा',
  ilaam: 'इलाम',
  ilam: 'इलाम',
  panchthar: 'पाँचथर',
  taplejung: 'ताप्लेजुङ',
  sankhuwasabha: 'सङ्खुवासभा',
  bhojpur: 'भोजपुर',
  terhathum: 'तेह्रथुम',
  dhankuta: 'धनकुटा',
  solukhumbu: 'सोलुखुम्बु',
  khotang: 'खोटाङ',
  okhaldhunga: 'ओखलढुङ्गा',
  udayapur: 'उदयपुर',
  saptari: 'सप्तरी',
  siraha: 'सिराहा',
  dhanusha: 'धनुषा',
  mahottari: 'महोत्तरी',
  sarlahi: 'सर्लाही',
  rautahat: 'रौतहट',
  bara: 'बारा',
  parsa: 'पर्सा',
  dolakha: 'दोलखा',
  ramechhap: 'रामेछाप',
  sindhuli: 'सिन्धुली',
  rasuwa: 'रसुवा',
};

// ----------------------------------------------------------------------------
// ४. नेपाली युनिकोड रोमनाइज्ड फनेटिक इन्जिन (Phonetic Transliteration Engine)
// ----------------------------------------------------------------------------
interface PhoneticRule {
  key: string;
  dev: string;
}

const CONSONANTS: PhoneticRule[] = [
  // Special conjuncts & compound consonants first
  { key: 'shree', dev: 'श्री' },
  { key: 'shri', dev: 'श्री' },
  { key: 'gya', dev: 'ज्ञ' },
  { key: 'gy', dev: 'ज्ञ्' },
  { key: 'jnya', dev: 'ज्ञ' },
  { key: 'ksha', dev: 'क्ष' },
  { key: 'ksh', dev: 'क्ष्' },
  { key: 'tra', dev: 'त्र' },
  { key: 'tr', dev: 'त्र्' },
  { key: 'chha', dev: 'छ' },
  { key: 'chh', dev: 'छ्' },
  { key: 'Chha', dev: 'छ' },
  { key: 'Chh', dev: 'छ्' },
  { key: 'shwa', dev: 'श्व' },
  { key: 'shw', dev: 'श्व्' },
  { key: 'shra', dev: 'श्र' },
  { key: 'shr', dev: 'श्र्' },
  { key: 'ddha', dev: 'द्ध' },
  { key: 'ddh', dev: 'द्ध्' },
  { key: 'dwa', dev: 'द्व' },
  { key: 'dya', dev: 'द्य' },
  { key: 'hree', dev: 'ह्री' },
  { key: 'hri', dev: 'हृ' },
  { key: 'hru', dev: 'ह्रु' },
  { key: 'kha', dev: 'ख' },
  { key: 'kh', dev: 'ख्' },
  { key: 'gha', dev: 'घ' },
  { key: 'gh', dev: 'घ्' },
  { key: 'nga', dev: 'ङ' },
  { key: 'ng', dev: 'ङ्' },
  { key: 'cha', dev: 'च' },
  { key: 'ch', dev: 'च्' },
  { key: 'jha', dev: 'झ' },
  { key: 'jh', dev: 'झ्' },
  { key: 'nya', dev: 'ञ' },
  { key: 'ny', dev: 'ञ्' },
  { key: 'yna', dev: 'ञ' },
  { key: 'yn', dev: 'ञ्' },
  { key: 'Tha', dev: 'ठ' },
  { key: 'Th', dev: 'ठ्' },
  { key: 'Dha', dev: 'ढ' },
  { key: 'Dh', dev: 'ढ्' },
  { key: 'tha', dev: 'थ' },
  { key: 'th', dev: 'थ्' },
  { key: 'dha', dev: 'ध' },
  { key: 'dh', dev: 'ध्' },
  { key: 'pha', dev: 'फ' },
  { key: 'ph', dev: 'फ्' },
  { key: 'bha', dev: 'भ' },
  { key: 'bh', dev: 'भ्' },
  { key: 'sha', dev: 'श' },
  { key: 'sh', dev: 'श्' },
  { key: 'Sha', dev: 'ष' },
  { key: 'Sh', dev: 'ष्' },
  { key: 'kra', dev: 'क्र' },
  { key: 'pra', dev: 'प्र' },
  { key: 'bra', dev: 'ब्र' },
  { key: 'gra', dev: 'ग्र' },
  { key: 'dra', dev: 'द्र' },
  { key: 'bhra', dev: 'भ्र' },
  { key: 'mra', dev: 'म्र' },
  { key: 'sra', dev: 'स्र' },
  { key: 'tt', dev: 'त्त' },
  { key: 'dd', dev: 'द्द' },
  { key: 'nn', dev: 'न्न' },
  { key: 'mm', dev: 'म्म' },
  { key: 'll', dev: 'ल्ल' },
  { key: 'ss', dev: 'स्स' },
  { key: 'Ta', dev: 'ट' },
  { key: 'T', dev: 'ट्' },
  { key: 'Da', dev: 'ड' },
  { key: 'D', dev: 'ड्' },
  { key: 'Na', dev: 'ण' },
  { key: 'N', dev: 'ण्' },
  { key: 'ka', dev: 'क' },
  { key: 'k', dev: 'क्' },
  { key: 'ga', dev: 'ग' },
  { key: 'g', dev: 'ग्' },
  { key: 'ja', dev: 'ज' },
  { key: 'j', dev: 'ज्' },
  { key: 'ta', dev: 'त' },
  { key: 't', dev: 'त्' },
  { key: 'da', dev: 'द' },
  { key: 'd', dev: 'द्' },
  { key: 'na', dev: 'न' },
  { key: 'n', dev: 'न्' },
  { key: 'pa', dev: 'प' },
  { key: 'p', dev: 'प्' },
  { key: 'fa', dev: 'फ' },
  { key: 'f', dev: 'फ्' },
  { key: 'ba', dev: 'ब' },
  { key: 'b', dev: 'ब्' },
  { key: 'ma', dev: 'म' },
  { key: 'm', dev: 'म्' },
  { key: 'ya', dev: 'य' },
  { key: 'y', dev: 'य्' },
  { key: 'ra', dev: 'र' },
  { key: 'r', dev: 'र्' },
  { key: 'la', dev: 'ल' },
  { key: 'l', dev: 'ल्' },
  { key: 'wa', dev: 'व' },
  { key: 'w', dev: 'व्' },
  { key: 'va', dev: 'व' },
  { key: 'v', dev: 'व्' },
  { key: 'sa', dev: 'स' },
  { key: 's', dev: 'स्' },
  { key: 'ha', dev: 'ह' },
  { key: 'h', dev: 'ह्' },
  { key: 'xa', dev: 'क्ष' },
  { key: 'x', dev: 'क्ष्' },
  { key: 'za', dev: 'ज' },
  { key: 'z', dev: 'ज्' },
  { key: 'La', dev: 'ळ' },
  { key: 'L', dev: 'ळ्' },
];

const INDEPENDENT_VOWELS: PhoneticRule[] = [
  { key: 'aau', dev: 'आउ' },
  { key: 'aae', dev: 'आए' },
  { key: 'aai', dev: 'आई' },
  { key: 'aao', dev: 'आओ' },
  { key: 'aaa', dev: 'आ' },
  { key: 'aa', dev: 'आ' },
  { key: 'A', dev: 'आ' },
  { key: 'ai', dev: 'ऐ' },
  { key: 'au', dev: 'औ' },
  { key: 'ou', dev: 'औ' },
  { key: 'ee', dev: 'ई' },
  { key: 'ei', dev: 'एइ' },
  { key: 'oo', dev: 'ऊ' },
  { key: 'uu', dev: 'ऊ' },
  { key: 'ri', dev: 'ऋ' },
  { key: 'Ri', dev: 'ऋ' },
  { key: 'am', dev: 'अं' },
  { key: 'an', dev: 'अं' },
  { key: 'ah', dev: 'अः' },
  { key: 'a', dev: 'अ' },
  { key: 'i', dev: 'इ' },
  { key: 'I', dev: 'ई' },
  { key: 'u', dev: 'उ' },
  { key: 'U', dev: 'ऊ' },
  { key: 'e', dev: 'ए' },
  { key: 'E', dev: 'ऐ' },
  { key: 'o', dev: 'ओ' },
  { key: 'O', dev: 'औ' },
];

const MATRAS: PhoneticRule[] = [
  { key: 'aaa', dev: 'ा' },
  { key: 'aa', dev: 'ा' },
  { key: 'A', dev: 'ा' },
  { key: 'a', dev: '' }, // removes halanta
  { key: 'ai', dev: 'ै' },
  { key: 'au', dev: 'ौ' },
  { key: 'ou', dev: 'ौ' },
  { key: 'ee', dev: 'ी' },
  { key: 'oo', dev: 'ू' },
  { key: 'uu', dev: 'ू' },
  { key: 'ri', dev: 'ृ' },
  { key: 'Ri', dev: 'ृ' },
  { key: 'i', dev: 'ि' },
  { key: 'I', dev: 'ी' },
  { key: 'u', dev: 'ु' },
  { key: 'U', dev: 'ू' },
  { key: 'e', dev: 'े' },
  { key: 'E', dev: 'ै' },
  { key: 'o', dev: 'ो' },
  { key: 'O', dev: 'ौ' },
  { key: 'M', dev: 'ं' },
  { key: 'H', dev: 'ः' },
  { key: '~', dev: 'ँ' },
];

/**
 * Transliterate a single Romanized word into Nepali Unicode
 */
export function transliterateWord(rawWord: string): string {
  if (!rawWord) return '';

  const lowerWord = rawWord.toLowerCase();
  if (COMMON_NEPALI_WORDS[lowerWord]) {
    return COMMON_NEPALI_WORDS[lowerWord];
  }

  let result = '';
  let i = 0;
  const len = rawWord.length;

  while (i < len) {
    const char = rawWord[i];

    // Digits
    if (NEPALI_NUMERALS[char]) {
      result += NEPALI_NUMERALS[char];
      i++;
      continue;
    }

    // Special punctuation
    if (char === '|') {
      result += '।';
      i++;
      continue;
    }
    if (char === ':') {
      result += 'ः';
      i++;
      continue;
    }

    // Non-alphabet characters
    if (!/[a-zA-Z~]/.test(char)) {
      result += char;
      i++;
      continue;
    }

    // Determine whether we are after halanta
    const lastResultChar = result.length > 0 ? result[result.length - 1] : '';
    const isAfterHalanta = lastResultChar === '्';

    // If after halanta, check if current letters form a vowel (matra)
    if (isAfterHalanta) {
      let matchedMatra = false;
      for (const m of MATRAS) {
        if (rawWord.startsWith(m.key, i)) {
          // Remove the halanta '्'
          result = result.slice(0, -1);
          result += m.dev;
          i += m.key.length;
          matchedMatra = true;
          break;
        }
      }
      if (matchedMatra) continue;
    }

    // Check consonants
    let matchedConsonant = false;
    for (const c of CONSONANTS) {
      if (rawWord.startsWith(c.key, i)) {
        result += c.dev;
        i += c.key.length;
        matchedConsonant = true;
        break;
      }
    }
    if (matchedConsonant) continue;

    // Check independent vowels
    let matchedVowel = false;
    for (const v of INDEPENDENT_VOWELS) {
      if (rawWord.startsWith(v.key, i)) {
        result += v.dev;
        i += v.key.length;
        matchedVowel = true;
        break;
      }
    }
    if (matchedVowel) continue;

    // Fallback
    result += char;
    i++;
  }

  return result;
}

/**
 * Transliterates an entire string from Romanized English to Nepali Unicode
 */
export function transliterateRomanToNepali(
  input: string,
  options: { convertDigits?: boolean } = { convertDigits: true }
): string {
  if (!input) return '';

  const tokens = input.split(/([ \t\n\r,./;:'"[\]{}()_+=!@#$%^&*`~<>-]+)/);

  return tokens
    .map((token) => {
      if (!token) return '';
      if (/^[ \t\n\r,./;:'"[\]{}()_+=!@#$%^&*`~<>-]+$/.test(token)) {
        if (options.convertDigits) {
          return token.replace(/\d/g, (d) => NEPALI_NUMERALS[d] || d);
        }
        return token;
      }
      if (/^\d+$/.test(token)) {
        return options.convertDigits
          ? token.replace(/\d/g, (d) => NEPALI_NUMERALS[d] || d)
          : token;
      }
      return transliterateWord(token);
    })
    .join('');
}

/**
 * Converts English digits (0-9) to Nepali Unicode digits (०-९)
 */
export function toNepaliDigitsOnly(text: string): string {
  if (!text) return '';
  return text.replace(/\d/g, (d) => NEPALI_NUMERALS[d] || d);
}

/**
 * Converts Nepali Unicode digits (०-९) to English digits (0-9)
 */
export function toEnglishDigitsOnly(text: string): string {
  if (!text) return '';
  return text.replace(/[०-९]/g, (d) => ENGLISH_NUMERALS[d] || d);
}
