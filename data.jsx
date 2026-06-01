// data.jsx — sample offer data + derived calculations + stock history

const OFFER = {
  company: "Snap Inc.",
  companyTag: "NYSE: SNAP",
  role: "Software Engineer, New Grad (L3)",
  location: "Los Angeles, CA",
  base: 145000,
  signOn: 25000,
  rsuTotal: 180000,
  rsuYears: 4,
  bonusPct: 0.10,
};

// Rough, transparent first-year take-home calculation.
// Year 1 gross: base + sign-on + 25% of RSU grant (vests after cliff) + bonus target.
// Deductions: federal effective ~22%, CA state effective ~8%, FICA 7.65%, LA rent baseline.
const Y1 = (() => {
  const baseGross = OFFER.base;
  const signOnGross = OFFER.signOn;
  const rsuGross = OFFER.rsuTotal / OFFER.rsuYears; // year-1 vest
  const bonusGross = OFFER.base * OFFER.bonusPct;
  const totalGross = baseGross + signOnGross + rsuGross + bonusGross;

  const FED_RATE = 0.22;
  const CA_RATE = 0.08;
  const FICA_RATE = 0.0765;
  const combinedTax = FED_RATE + CA_RATE + FICA_RATE; // 0.3765

  // Sign-on & RSU are taxed as supplemental wages; model them at same effective rate for simplicity.
  const baseNet = Math.round(baseGross * (1 - combinedTax));
  const signOnNet = Math.round(signOnGross * (1 - combinedTax));
  const rsuNet = Math.round(rsuGross * (1 - combinedTax));
  const bonusNet = Math.round(bonusGross * (1 - combinedTax));

  const RENT_LA_MONTHLY = 2400; // modest 1BR in a reasonable LA neighborhood
  const rentAnnual = RENT_LA_MONTHLY * 12;

  const afterTax = baseNet + signOnNet + rsuNet + bonusNet;
  const afterRent = afterTax - rentAnnual;

  return {
    gross: totalGross,
    baseGross, baseNet,
    signOnGross, signOnNet,
    rsuGross, rsuNet,
    bonusGross, bonusNet,
    afterTax,
    rentAnnual,
    rentMonthly: RENT_LA_MONTHLY,
    takeHome: afterRent,
  };
})();

// Fictional ~5 year stock history (monthly closes). Mirrors the "dramatic IPO
// with recent pullback + layoffs" scenario requested — starts around $12, rips
// to the mid-$70s on pandemic highs, falls to single digits, partial recovery.
const STOCK_HISTORY = [
  // [YYYY-MM, close]
  ["2021-04", 56.2], ["2021-05", 62.8], ["2021-06", 68.4], ["2021-07", 73.1],
  ["2021-08", 76.5], ["2021-09", 74.2], ["2021-10", 75.0], ["2021-11", 50.3],
  ["2021-12", 46.9], ["2022-01", 37.6], ["2022-02", 41.2], ["2022-03", 36.4],
  ["2022-04", 28.8], ["2022-05", 19.1], ["2022-06", 14.3], ["2022-07", 15.8],
  ["2022-08", 11.6], ["2022-09", 9.8],  ["2022-10", 8.4],  ["2022-11", 9.1],
  ["2022-12", 8.9],  ["2023-01", 10.4], ["2023-02", 10.9], ["2023-03", 11.2],
  ["2023-04", 8.6],  ["2023-05", 9.4],  ["2023-06", 11.0], ["2023-07", 12.3],
  ["2023-08", 9.8],  ["2023-09", 9.1],  ["2023-10", 8.8],  ["2023-11", 14.9],
  ["2023-12", 16.8], ["2024-01", 17.2], ["2024-02", 11.3], ["2024-03", 11.6],
  ["2024-04", 11.9], ["2024-05", 15.1], ["2024-06", 14.7], ["2024-07", 13.2],
  ["2024-08", 10.2], ["2024-09", 10.8], ["2024-10", 10.4], ["2024-11", 11.6],
  ["2024-12", 11.1], ["2025-01", 11.9], ["2025-02", 10.4], ["2025-03", 8.9],
  ["2025-04", 9.2],  ["2025-05", 10.6], ["2025-06", 10.9], ["2025-07", 10.2],
  ["2025-08", 9.4],  ["2025-09", 8.7],  ["2025-10", 8.1],  ["2025-11", 9.6],
  ["2025-12", 10.3], ["2026-01", 10.8], ["2026-02", 9.8],  ["2026-03", 9.9],
  ["2026-04", 10.4],
];

const STOCK_ANNOTATIONS = [
  { date: "2021-07", label: "Peak: $76.50" },
  { date: "2022-08", label: "Layoffs: 20%" },
  { date: "2023-09", label: "Layoffs: 10%" },
  { date: "2026-04", label: "Today: $10.40" },
];

// Jargon definitions — used by <JargonTerm>.
const JARGON = {
  RSU: "Restricted Stock Units. Shares of company stock your employer promises to give you over time (as you 'vest'). You don't own them until they vest — and they're only worth what the stock is trading at on that day.",
  RSUs: "Restricted Stock Units. Shares of company stock your employer promises to give you over time (as you 'vest'). You don't own them until they vest — and they're only worth what the stock is trading at on that day.",
  vesting: "The schedule on which you actually earn your stock. A 4-year vest with a 1-year cliff means you get nothing if you leave before month 12, then 25% at month 12, then the rest in small chunks.",
  vest: "The schedule on which you actually earn your stock. A 4-year vest with a 1-year cliff means you get nothing if you leave before month 12, then 25% at month 12, then the rest in small chunks.",
  cliff: "A waiting period before any equity vests. A 1-year cliff means you get zero shares until you've worked there for a full year — then 25% hits at once.",
  clawback: "A clause that lets the company take money back. Here it means: if you quit within 12 months, you have to repay the full sign-on bonus.",
  "ordinary income": "Taxed the same way as your salary — at your regular income tax rate. (Not the lower capital-gains rate people talk about for long-held stock.)",
  refresh: "A new RSU grant given to existing employees, usually annually, to keep total equity topped up as the original grant vests down.",
  "equity acceleration": "A clause that vests some or all of your unvested stock immediately if you're let go without cause or if the company is acquired.",
};

Object.assign(window, { OFFER, Y1, STOCK_HISTORY, STOCK_ANNOTATIONS, JARGON });
