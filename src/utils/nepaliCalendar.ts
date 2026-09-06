import NepaliDate, { dateConfigMap } from 'nepali-date-converter';

/**
 * Nepali (Bikram Sambat) Calendar and Date Converter Utility
 * Accurate for standard Nepal Government accounting (2000 BS to 2090+ BS)
 * Powered by official Nepal Panchanga Nirnayak Samiti calendar rules
 */

export const NEPALI_MONTH_NAMES = [
  'बैशाख',
  'जेठ',
  'अषाढ',
  'श्रावण',
  'भाद्र',
  'असोज',
  'कार्तिक',
  'मंसिर',
  'पौष',
  'माघ',
  'फागुन',
  'चैत्र',
];

export const FISCAL_YEAR_MONTHS_ORDER = [
  'श्रावण',
  'भाद्र',
  'असोज',
  'कार्तिक',
  'मंसिर',
  'पौष',
  'माघ',
  'फागुन',
  'चैत्र',
  'बैशाख',
  'जेठ',
  'अषाढ',
];

export const NEPALI_WEEK_DAYS = ['आइत', 'सोम', 'मंगल', 'बुध', 'बिही', 'शुक्र', 'शनि'];

const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

const MONTH_KEYS = [
  'Baisakh',
  'Jestha',
  'Asar',
  'Shrawan',
  'Bhadra',
  'Aswin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
] as const;

export function toNepaliDigits(input: number | string | null | undefined): string {
  if (input === null || input === undefined) return '';
  return input
    .toString()
    .split('')
    .map((char) => {
      const digit = parseInt(char, 10);
      return !isNaN(digit) ? NEPALI_DIGITS[digit] : char;
    })
    .join('');
}

export function toEnglishDigits(input: string | null | undefined): string {
  if (!input) return '';
  let res = '';
  for (const char of input.toString()) {
    const idx = NEPALI_DIGITS.indexOf(char);
    if (idx !== -1) {
      res += idx.toString();
    } else {
      res += char;
    }
  }
  return res;
}

/**
 * Format string or number with either Devanagari or English digits based on toggle
 */
export function toDisplayDigits(
  input: string | number | null | undefined,
  useDevanagari: boolean = true
): string {
  if (input === null || input === undefined) return '';
  const str = input.toString();
  return useDevanagari ? toNepaliDigits(str) : toEnglishDigits(str);
}

/**
 * Format pure number in Nepali 0.00 format with Devanagari numerals
 * e.g., 0 -> "०.००", 35000 -> "३५,०००.००", 125000.5 -> "१,२५,०००.५०"
 */
export function formatNepaliNumber(
  amount: number,
  options: {
    useDevanagari?: boolean;
    decimals?: number;
    showThousandsSeparator?: boolean;
  } = {}
): string {
  const { useDevanagari = true, decimals = 2, showThousandsSeparator = true } = options;
  if (isNaN(amount) || amount === null || amount === undefined) {
    return useDevanagari ? '०.००' : '0.00';
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const fixedStr = absAmount.toFixed(decimals);
  const parts = fixedStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] ? `.${parts[1]}` : '';

  let formattedInteger = integerPart;
  if (showThousandsSeparator && integerPart.length > 3) {
    const last3 = integerPart.substring(integerPart.length - 3);
    const otherDigits = integerPart.substring(0, integerPart.length - 3);
    const groups: string[] = [];
    for (let i = otherDigits.length; i > 0; i -= 2) {
      const start = Math.max(0, i - 2);
      groups.unshift(otherDigits.substring(start, i));
    }
    formattedInteger = groups.join(',') + ',' + last3;
  }

  const resultEnglish = `${isNegative ? '-' : ''}${formattedInteger}${decimals > 0 ? decimalPart : ''}`;

  if (useDevanagari) {
    return toNepaliDigits(resultEnglish);
  }
  return resultEnglish;
}

/**
 * Format currency in Nepali style (Lakh/Crore format):
 * e.g., Rs. 1,25,000.00 or रु. १,२५,०००.००
 */
export function formatNepaliCurrency(
  amount: number,
  options: {
    useDevanagari?: boolean;
    showSymbol?: boolean;
    decimals?: number;
  } = {}
): string {
  const { useDevanagari = true, showSymbol = true, decimals = 2 } = options;
  if (isNaN(amount) || amount === null || amount === undefined) {
    return (showSymbol ? 'रु. ' : '') + (useDevanagari ? '०.००' : '0.00');
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const fixedStr = absAmount.toFixed(decimals);
  const parts = fixedStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] ? `.${parts[1]}` : '';

  let formattedInteger = '';
  if (integerPart.length > 3) {
    const last3 = integerPart.substring(integerPart.length - 3);
    const otherDigits = integerPart.substring(0, integerPart.length - 3);
    const groups: string[] = [];
    for (let i = otherDigits.length; i > 0; i -= 2) {
      const start = Math.max(0, i - 2);
      groups.unshift(otherDigits.substring(start, i));
    }
    formattedInteger = groups.join(',') + ',' + last3;
  } else {
    formattedInteger = integerPart;
  }

  const resultEnglish = `${isNegative ? '-' : ''}${formattedInteger}${decimals > 0 ? decimalPart : ''}`;
  const symbol = showSymbol ? (useDevanagari ? 'रु. ' : 'Rs. ') : '';

  if (useDevanagari) {
    return symbol + toNepaliDigits(resultEnglish);
  }
  return symbol + resultEnglish;
}

/**
 * Returns current timestamp in Nepal Time (UTC+5:45)
 */
export function getTodayNepalDate(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const nepalOffset = 5.75 * 60 * 60 * 1000;
  return new Date(utc + nepalOffset);
}

/**
 * Total days in given BS month
 */
export function getDaysInBsMonth(year: number, month: number): number {
  try {
    const yrKey = String(year);
    const yearObj = (dateConfigMap as Record<string, Record<string, number>>)[yrKey];
    if (yearObj && month >= 1 && month <= 12) {
      const key = MONTH_KEYS[month - 1];
      if (yearObj[key]) {
        return yearObj[key];
      }
    }
    // Fallback using NepaliDate diff
    const d1 = new NepaliDate(year, month - 1, 1);
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const d2 = new NepaliDate(nextYear, nextMonth - 1, 1);
    const diff = Math.round((d2.toJsDate().getTime() - d1.toJsDate().getTime()) / 86400000);
    if (diff >= 28 && diff <= 32) return diff;
  } catch {
    // Fallback
  }
  return 30;
}

/**
 * Weekday of first day of given BS month (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 */
export function getBsMonthFirstDayOfWeek(year: number, month: number): number {
  try {
    const d = new NepaliDate(year, month - 1, 1);
    return d.getDay();
  } catch {
    return 0;
  }
}

/**
 * Available BS years supported by the converter
 */
export function getAvailableBsYears(): number[] {
  try {
    const years = Object.keys(dateConfigMap)
      .map((y) => parseInt(y, 10))
      .filter((y) => !isNaN(y))
      .sort((a, b) => a - b);
    if (years.length > 0) return years;
  } catch {
    // Fallback
  }
  const fallback: number[] = [];
  for (let y = 2030; y <= 2095; y++) {
    fallback.push(y);
  }
  return fallback;
}

/**
 * BS Date to AD Date converter
 */
export function bsToAd(bsDateStr: string): {
  adYear: number;
  adMonth: number;
  adDay: number;
  formattedAD: string;
} {
  try {
    const normalized = toEnglishDigits(bsDateStr).trim();
    const parts = normalized.split(/[-/.]/).map((p) => parseInt(p, 10));
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const year = parts[0];
      const month = Math.min(12, Math.max(1, parts[1]));
      const maxDays = getDaysInBsMonth(year, month);
      const day = Math.min(maxDays, Math.max(1, parts[2]));

      const nep = new NepaliDate(year, month - 1, day);
      const jsDate = nep.toJsDate();
      const adYear = jsDate.getFullYear();
      const adMonth = jsDate.getMonth() + 1;
      const adDay = jsDate.getDate();
      const formattedAD = `${adYear}-${String(adMonth).padStart(2, '0')}-${String(adDay).padStart(2, '0')}`;
      return {
        adYear,
        adMonth,
        adDay,
        formattedAD,
      };
    }
  } catch (err) {
    console.error('Error converting BS to AD:', err);
  }
  return { adYear: NaN, adMonth: NaN, adDay: NaN, formattedAD: '' };
}

/**
 * AD Date to BS Date converter
 */
export function adToBs(adDateStr: string): {
  bsYear: number;
  bsMonth: number;
  bsDay: number;
  formattedBS: string;
  formattedBSDevanagari: string;
} {
  try {
    if (!adDateStr || typeof adDateStr !== 'string') {
      const cur = getCurrentDualDate();
      return {
        bsYear: cur.bsYear,
        bsMonth: cur.bsMonth,
        bsDay: cur.bsDay,
        formattedBS: `${cur.bsYear}/${String(cur.bsMonth).padStart(2, '0')}/${String(cur.bsDay).padStart(2, '0')}`,
        formattedBSDevanagari: cur.bs,
      };
    }

    const clean = adDateStr.split('T')[0].trim();
    const parts = clean.split(/[-/.]/).map((p) => parseInt(p, 10));
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      // Create date with noon hour to prevent UTC/local day-boundary shift
      const jsDate = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
      const nep = new NepaliDate(jsDate);
      const bsYear = nep.getYear();
      const bsMonth = nep.getMonth() + 1;
      const bsDay = nep.getDate();
      const formattedBS = `${bsYear}/${String(bsMonth).padStart(2, '0')}/${String(bsDay).padStart(2, '0')}`;
      const formattedBSDevanagari = toNepaliDigits(formattedBS);

      return {
        bsYear,
        bsMonth,
        bsDay,
        formattedBS,
        formattedBSDevanagari,
      };
    }
  } catch (err) {
    console.error('Error converting AD to BS:', err);
  }

  const cur = getCurrentDualDate();
  return {
    bsYear: cur.bsYear,
    bsMonth: cur.bsMonth,
    bsDay: cur.bsDay,
    formattedBS: `${cur.bsYear}/${String(cur.bsMonth).padStart(2, '0')}/${String(cur.bsDay).padStart(2, '0')}`,
    formattedBSDevanagari: cur.bs,
  };
}

/**
 * Returns formatted dual date: e.g. "२०८३/०५/१६ (2026-09-01)"
 */
export function getDualDateString(bsDate?: string, adDate?: string): string {
  let bs = bsDate;
  let ad = adDate;

  if (!bs && ad) {
    bs = adToBs(ad).formattedBSDevanagari;
  } else if (bs && !ad) {
    ad = bsToAd(bs).formattedAD;
  } else if (!bs && !ad) {
    const cur = getCurrentDualDate();
    bs = cur.bs;
    ad = cur.ad;
  }

  const bsFormatted = toNepaliDigits(bs || '');
  return `${bsFormatted} (${ad})`;
}

/**
 * Accurate Current Today Dual Date (BS & AD) in Nepal Standard Time
 */
export function getCurrentDualDate(): {
  bs: string;
  ad: string;
  dual: string;
  bsYear: number;
  bsMonth: number;
  bsDay: number;
  adYear: number;
  adMonth: number;
  adDay: number;
} {
  const nepalNow = getTodayNepalDate();
  const adYear = nepalNow.getFullYear();
  const adMonth = nepalNow.getMonth() + 1;
  const adDay = nepalNow.getDate();
  const ad = `${adYear}-${String(adMonth).padStart(2, '0')}-${String(adDay).padStart(2, '0')}`;

  const nepaliDate = new NepaliDate(nepalNow);
  const bsYear = nepaliDate.getYear();
  const bsMonth = nepaliDate.getMonth() + 1;
  const bsDay = nepaliDate.getDate();

  const formattedBS = `${bsYear}/${String(bsMonth).padStart(2, '0')}/${String(bsDay).padStart(2, '0')}`;
  const formattedBSDevanagari = toNepaliDigits(formattedBS);

  return {
    bs: formattedBSDevanagari,
    ad,
    dual: `${formattedBSDevanagari} (${ad})`,
    bsYear,
    bsMonth,
    bsDay,
    adYear,
    adMonth,
    adDay,
  };
}

/**
 * Extract starting BS year number from a fiscal year string (Devanagari or English digits)
 * e.g. "२०८३/८४" -> 2083, "2081/82" -> 2081
 */
export function extractBsYear(fyStr: string): number {
  if (!fyStr) return 0;
  const normalized = toEnglishDigits(fyStr).trim();
  const match = normalized.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * Sorts Fiscal Years in Descending Order (नवीनतम देखि पुरानो / घट्दो क्रममा)
 * e.g. ["२०८३/८४", "२०८२/८३", "२०८१/८२", "२०८०/८१", "२०७९/८०"]
 */
export function sortFiscalYearsDescending(years: string[]): string[] {
  if (!years || !Array.isArray(years)) return [];
  const unique = Array.from(new Set(years.filter((y) => Boolean(y && y.trim()))));
  return unique.sort((a, b) => {
    const yearA = extractBsYear(a);
    const yearB = extractBsYear(b);
    if (yearA !== yearB) {
      return yearB - yearA; // Descending order
    }
    return b.localeCompare(a);
  });
}

/**
 * Default standard Nepal Government Fiscal Years in Descending Order
 */
export const DEFAULT_FISCAL_YEARS_LIST = [
  '२०८३/८४',
  '२०८२/८३',
  '२०८१/८२',
  '२०८०/८१',
  '२०७९/८०',
  '२०७८/७९',
];
