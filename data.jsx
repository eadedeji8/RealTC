// data.jsx — sample offer data + derived calculations + stock history

// Neutral placeholder until an offer is decoded — no company-specific branding.
// applyParsedOffer() fills these in from the parsed offer letter.
const OFFER = {
  company: "",
  companyTag: "",
  role: "",
  location: "",
  base: 0,
  signOn: 0,
  rsuTotal: 0,
  rsuYears: 4,
  bonusPct: 0,
};

// BRIEF — the Claude-generated company/location context (taxes, rent, perks,
// layoffs, demographics, flags). Everything starts empty/null — the dashboard
// is gated behind a decoded offer, so nothing here renders before applyBrief()
// fills it in. computeTakeHome falls back to generic US-effective rates via
// num() when the brief hasn't supplied a value. Mutated in place by applyBrief().
const BRIEF = {
  ticker: null,
  companyDomain: null,
  isPublic: true,
  location: {
    city: null, state: null,
    fedEffectiveRate: null, stateEffectiveRate: null, ficaRate: null,
    monthlyRent1br: null, costOfLivingIndex: null,
    demographics: { summary: null, notableGroups: [], notes: null },
  },
  benefits: [],
  layoffs: [],
  missingFlags: [],
  stockNarrative: null,
  rsuNote: null,
  caveats: "All figures here are estimates to help you ask better questions — not tax or legal advice. Have a lawyer review any contract language.",
};

// Rough, transparent first-year take-home calculation.
// Year 1 gross: base + sign-on + 25% of RSU grant (vests after cliff) + bonus target.
// Tax rates + rent come from the brief when available, else generic US defaults.
function computeTakeHome(offer, brief) {
  const loc = (brief && brief.location) || {};
  const baseGross = offer.base;
  const signOnGross = offer.signOn;
  const rsuGross = offer.rsuYears > 0 ? offer.rsuTotal / offer.rsuYears : 0; // year-1 vest
  const bonusGross = offer.base * offer.bonusPct;
  const totalGross = baseGross + signOnGross + rsuGross + bonusGross;

  const fed = num(loc.fedEffectiveRate, 0.22);
  const state = num(loc.stateEffectiveRate, 0.08);
  const fica = num(loc.ficaRate, 0.0765);
  const combinedTax = fed + state + fica;

  // Sign-on & RSU are taxed as supplemental wages; model them at the same effective rate for simplicity.
  const baseNet = Math.round(baseGross * (1 - combinedTax));
  const signOnNet = Math.round(signOnGross * (1 - combinedTax));
  const rsuNet = Math.round(rsuGross * (1 - combinedTax));
  const bonusNet = Math.round(bonusGross * (1 - combinedTax));

  const rentMonthly = num(loc.monthlyRent1br, 2400);
  const rentAnnual = rentMonthly * 12;

  const afterTax = baseNet + signOnNet + rsuNet + bonusNet;
  const afterRent = afterTax - rentAnnual;

  return {
    gross: totalGross,
    baseGross, baseNet,
    signOnGross, signOnNet,
    rsuGross, rsuNet,
    bonusGross, bonusNet,
    afterTax,
    combinedTax,
    rentAnnual,
    rentMonthly,
    takeHome: afterRent,
  };
}

function num(v, fallback) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

// Y1 is mutated in place (never reassigned) so every script that captured the
// reference sees fresh numbers after a re-decode.
const Y1 = {};
Object.assign(Y1, computeTakeHome(OFFER, BRIEF));

// Coerce any value into something safe to render as a React text child. Claude
// occasionally returns an object/array where the schema asked for a string
// (e.g. notableGroups: [{group, pct}]); rendering that throws "Objects are not
// valid as a React child" and blanks the whole page. asText flattens it.
function asText(v) {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(", ");
  if (typeof v === "object") {
    return v.name || v.label || v.group || v.title || v.text || v.description
      || Object.values(v).map(asText).filter(Boolean).join(" — ");
  }
  return String(v);
}
function asTextList(v) {
  if (v == null) return [];
  if (!Array.isArray(v)) return [asText(v)].filter(Boolean);
  return v.map(asText).filter(Boolean);
}
function toNum(v) {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// Normalize a raw brief so every field the UI renders has the expected type.
function sanitizeBrief(b) {
  if (!b || typeof b !== "object") return b;
  b.ticker = asText(b.ticker);
  b.companyDomain = asText(b.companyDomain);
  b.stockNarrative = asText(b.stockNarrative);
  b.rsuNote = asText(b.rsuNote);
  b.caveats = asText(b.caveats);
  if (b.location && typeof b.location === "object") {
    const L = b.location;
    L.city = asText(L.city);
    L.state = asText(L.state);
    L.fedEffectiveRate = toNum(L.fedEffectiveRate);
    L.stateEffectiveRate = toNum(L.stateEffectiveRate);
    L.ficaRate = toNum(L.ficaRate);
    L.monthlyRent1br = toNum(L.monthlyRent1br);
    L.costOfLivingIndex = toNum(L.costOfLivingIndex);
    if (L.demographics && typeof L.demographics === "object") {
      L.demographics.summary = asText(L.demographics.summary);
      L.demographics.notes = asText(L.demographics.notes);
      L.demographics.notableGroups = asTextList(L.demographics.notableGroups);
    }
  }
  if (Array.isArray(b.benefits)) b.benefits = b.benefits.map((x) => ({
    name: asText(x && x.name) || "Benefit",
    description: asText(x && x.description) || "",
    estAnnualValueUSD: toNum(x && x.estAnnualValueUSD),
    confidence: asText(x && x.confidence) || "low",
  }));
  if (Array.isArray(b.layoffs)) b.layoffs = b.layoffs.map((x) => ({
    date: asText(x && x.date) || "",
    pct: asText(x && x.pct),
    approxCount: asText(x && x.approxCount),
    teams: asTextList(x && x.teams),
    notes: asText(x && x.notes),
  }));
  if (Array.isArray(b.missingFlags)) b.missingFlags = b.missingFlags.map((x) => ({
    label: asText(x && x.label) || "Ask about this",
    why: asText(x && x.why) || "",
  }));
  return b;
}

// Replace BRIEF's contents in place with a freshly generated brief, filling any
// missing keys from the demo defaults so the UI never reads undefined.
function applyBrief(next) {
  if (!next || typeof next !== "object") return;
  sanitizeBrief(next);
  // Don't let a brief that couldn't find a domain wipe out the one the fast
  // parse step already resolved for the logo.
  if (!next.companyDomain && BRIEF.companyDomain) next.companyDomain = BRIEF.companyDomain;
  if (!next.location) next.location = BRIEF.location;
  if (!next.location.demographics) next.location.demographics = { summary: null, notableGroups: [], notes: null };
  if (!Array.isArray(next.benefits)) next.benefits = [];
  if (!Array.isArray(next.layoffs)) next.layoffs = [];
  if (!Array.isArray(next.missingFlags)) next.missingFlags = [];
  Object.keys(BRIEF).forEach((k) => { delete BRIEF[k]; });
  Object.assign(BRIEF, next);
}

// Recompute Y1 in place from the current OFFER + BRIEF.
function recomputeY1() {
  Object.assign(Y1, computeTakeHome(OFFER, BRIEF));
}

// Jargon definitions — used by <JargonTerm>.
const JARGON = {
  RSU: "Restricted Stock Units. Shares of company stock your employer promises to give you over time (as you 'vest'). You don't own them until they vest — and they're only worth what the stock is trading at on that day.",
  RSUs: "Restricted Stock Units. Shares of company stock your employer promises to give you over time (as you 'vest'). You don't own them until they vest — and they're only worth what the stock is trading at on that day.",
  vesting: "The schedule on which you actually earn your stock. A 4-year vest with a 1-year cliff means you get nothing if you leave before month 12, then 25% at month 12, then the rest in small chunks.",
  vest: "The schedule on which you actually earn your stock. A 4-year vest with a 1-year cliff means you get nothing if you leave before month 12, then 25% at month 12, then the rest in small chunks.",
  cliff: "A waiting period before any equity vests. A 1-year cliff means you get zero shares until you've worked there for a full year — then 25% hits at once.",
  clawback: "A clause that lets the company take money back. Most commonly: if you quit before a stated period (often 12 months), you have to repay some or all of your sign-on bonus. Check your offer letter for the exact terms.",
  "ordinary income": "Taxed the same way as your salary — at your regular income tax rate. (Not the lower capital-gains rate people talk about for long-held stock.)",
  refresh: "A new RSU grant given to existing employees, usually annually, to keep total equity topped up as the original grant vests down.",
  "equity acceleration": "A clause that vests some or all of your unvested stock immediately if you're let go without cause or if the company is acquired.",
};

Object.assign(window, {
  OFFER, BRIEF, Y1, JARGON,
  computeTakeHome, applyBrief, recomputeY1, num,
  sanitizeBrief, asText, asTextList,
});
