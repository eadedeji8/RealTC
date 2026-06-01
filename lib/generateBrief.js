// generateBrief.js — given a parsed offer, ask Claude for a structured "brief"
// of everything company/location-specific the dashboard needs: ticker, tax rates,
// cost of living, perks, layoff history, missing-clause flags, and demographics.
//
// IMPORTANT: every value here is an AI-generated ESTIMATE, not authoritative data.
// The schema captures that uncertainty (confidence fields, nullable values) and the
// UI labels it. Mirrors the raw-fetch style of parseOffer.js.
//
// Usage:
//   const { generateBrief } = require("./lib/generateBrief");
//   const brief = await generateBrief(parsedOffer);

const SYSTEM_PROMPT = [
  "You are a compensation analyst helping a first-generation new-grad software engineer understand a US tech job offer.",
  "Given the structured offer, produce a context brief via the provided tool.",
  "Everything you return is an estimate to help the user ask better questions — never present a guess as fact.",
  "Rules:",
  "- If you genuinely do not know a value, return null. Do not invent specific layoffs, perks, or numbers that you are not reasonably confident about.",
  "- All rates are decimal fractions (22% -> 0.22). Tax rates are realistic EFFECTIVE withholding rates for a single filer at this income, not marginal brackets.",
  "- stateEffectiveRate must be 0 for no-income-tax states (TX, FL, WA, NV, TN, etc.).",
  "- monthlyRent1br is a realistic 1-bedroom rent for the offer's city. costOfLivingIndex uses US average = 100.",
  "- ticker: the public stock symbol ONLY if the employer is publicly traded; otherwise null and isPublic=false.",
  "- For private companies, rsuNote MUST explain that the RSU dollar figure is highly uncertain (no public market, 409A valuations, liquidity risk).",
  "- benefits: concrete perks you are confident this employer offers (free meals, shuttles, commuter/ride credits, 401k match, dental/vision, wellness). Estimate annual dollar value where reasonable, else null.",
  "- layoffs: only well-known, real reductions. Empty array if none of note. Do not fabricate.",
  "- missingFlags: standard clauses a new grad should confirm are in/absent from the letter (refresh grants, equity acceleration on termination, relocation details, severance policy, clawback specifics).",
  "- caveats: one short paragraph reminding the user these are estimates and that contract language should go to a lawyer.",
  "- If the offer implies an international candidate or visa sponsorship, include a brief note in caveats that visa status reduces negotiating leverage.",
].join("\n");

const BRIEF_TOOL = {
  name: "build_brief",
  description: "Build the company + location context brief for this offer.",
  input_schema: {
    type: "object",
    properties: {
      ticker:        { type: ["string", "null"], description: "Public stock ticker symbol, or null if private/unknown." },
      companyDomain: { type: ["string", "null"], description: "Primary web domain for the company logo (e.g. 'snap.com')." },
      isPublic:      { type: "boolean", description: "True if the employer is publicly traded." },
      location: {
        type: "object",
        properties: {
          city:               { type: ["string", "null"], description: "City of the work location." },
          state:              { type: ["string", "null"], description: "Two-letter US state code." },
          fedEffectiveRate:   { type: ["number", "null"], description: "Estimated federal effective withholding rate (decimal)." },
          stateEffectiveRate: { type: ["number", "null"], description: "Estimated state income tax effective rate (decimal); 0 for no-income-tax states." },
          ficaRate:           { type: ["number", "null"], description: "FICA rate (decimal), typically 0.0765." },
          monthlyRent1br:     { type: ["number", "null"], description: "Realistic monthly rent for a 1-bedroom in this city, USD." },
          costOfLivingIndex:  { type: ["number", "null"], description: "Cost-of-living index where US average = 100." },
          demographics: {
            type: "object",
            properties: {
              summary:       { type: ["string", "null"], description: "1-2 sentence plain-language demographic/community picture of the area." },
              notableGroups: { type: "array", items: { type: "string" }, description: "Notable communities or groups represented in the area." },
              notes:         { type: ["string", "null"], description: "Anything relevant for someone moving here (diversity, cost, climate, commute)." },
            },
            required: ["summary", "notableGroups", "notes"],
          },
        },
        required: ["city", "state", "fedEffectiveRate", "stateEffectiveRate", "ficaRate", "monthlyRent1br", "costOfLivingIndex", "demographics"],
      },
      benefits: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name:             { type: "string", description: "Perk name (e.g. 'Free meals', 'Commuter shuttle')." },
            description:      { type: "string", description: "Plain-language description of the perk." },
            estAnnualValueUSD:{ type: ["number", "null"], description: "Rough annual dollar value, or null if not quantifiable." },
            confidence:       { type: "string", enum: ["high", "medium", "low"], description: "How confident this employer offers this perk." },
          },
          required: ["name", "description", "estAnnualValueUSD", "confidence"],
        },
      },
      layoffs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            date:        { type: "string", description: "Approximate date (e.g. 'Aug 2022')." },
            pct:         { type: ["string", "null"], description: "Approx percent of workforce cut (e.g. '20%')." },
            approxCount: { type: ["string", "null"], description: "Approx number of employees affected." },
            teams:       { type: "array", items: { type: "string" }, description: "Teams/areas hit, if known." },
            notes:       { type: ["string", "null"], description: "What this round signals." },
          },
          required: ["date", "pct", "approxCount", "teams", "notes"],
        },
      },
      missingFlags: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "The clause/topic to confirm." },
            why:   { type: "string", description: "Why it matters and what to ask." },
          },
          required: ["label", "why"],
        },
      },
      stockNarrative: { type: ["string", "null"], description: "2-3 sentence plain-language read on the stock's recent trajectory and what it means for RSUs." },
      rsuNote:        { type: ["string", "null"], description: "How to think about the RSU value for THIS company; flag private-company uncertainty when applicable." },
      caveats:        { type: "string", description: "Short reminder that these are estimates; lawyer for contract language; visa note if relevant." },
    },
    required: [
      "ticker", "companyDomain", "isPublic", "location",
      "benefits", "layoffs", "missingFlags",
      "stockNarrative", "rsuNote", "caveats",
    ],
  },
};

async function generateBrief(offer) {
  if (!offer || typeof offer !== "object") {
    throw new Error("generateBrief: offer must be an object");
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("generateBrief: ANTHROPIC_API_KEY environment variable is not set");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [BRIEF_TOOL],
      tool_choice: { type: "tool", name: "build_brief" },
      messages: [
        { role: "user", content: `Structured offer:\n\n${JSON.stringify(offer, null, 2)}` },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const toolUse = Array.isArray(data.content)
    ? data.content.find((b) => b.type === "tool_use" && b.name === "build_brief")
    : null;
  if (!toolUse) {
    throw new Error("generateBrief: model did not return a build_brief tool_use block");
  }
  return toolUse.input;
}

module.exports = { generateBrief };
