// parseOffer.js — extract structured fields from a job offer letter via the Anthropic API.
// Usage:
//   const { parseOffer } = require("./lib/parseOffer");
//   const fields = await parseOffer(offerLetterText);

const SYSTEM_PROMPT = [
  "You extract structured data from job offer letters for new-grad software engineers.",
  "Return values strictly via the provided tool. If a field is not stated or is ambiguous in the offer, return null for that field — do not guess or infer.",
  "Money fields are USD numbers without currency symbols or commas (e.g. 145000, not \"$145,000\").",
  "annualBonusPercent is a decimal fraction (e.g. 10% target bonus -> 0.10).",
  "companyDomain is the ONE exception to the no-inference rule: it is used only to fetch the company's logo, so you may supply it from your own knowledge of the employer even if it is not written in the letter (e.g. Google -> google.com, Snap Inc. -> snap.com). Return null if you are not confident which domain is correct — never invent one.",
].join(" ");

const EXTRACT_TOOL = {
  name: "extract_offer",
  description: "Extract the structured fields below from the offer letter text.",
  input_schema: {
    type: "object",
    properties: {
      company:               { type: ["string", "null"], description: "Employer / company name." },
      companyDomain:         { type: ["string", "null"], description: "The company's primary web domain in lowercase, no protocol or 'www' (e.g. 'snap.com', 'google.com'). Used only to fetch their logo. Infer from the company name for well-known employers; null if unsure." },
      role:                  { type: ["string", "null"], description: "Job title or role (e.g. 'Software Engineer, New Grad (L3)')." },
      location:              { type: ["string", "null"], description: "Primary work location (city, state)." },
      baseSalary:            { type: ["number", "null"], description: "Annual base salary in USD." },
      signOnBonus:           { type: ["number", "null"], description: "One-time sign-on bonus in USD." },
      signOnClawbackMonths:  { type: ["number", "null"], description: "Months the employee must stay to keep the sign-on bonus (clawback period)." },
      rsuTotal:              { type: ["number", "null"], description: "Total RSU grant value in USD over the full vesting period." },
      rsuVestingYears:       { type: ["number", "null"], description: "Total years over which RSUs vest (e.g. 4)." },
      rsuCliffMonths:        { type: ["number", "null"], description: "Months until the first vest (cliff). Typically 12." },
      annualBonusPercent:    { type: ["number", "null"], description: "Target annual bonus as a decimal of base (10% -> 0.10)." },
    },
    required: [
      "company", "companyDomain", "role", "location",
      "baseSalary", "signOnBonus", "signOnClawbackMonths",
      "rsuTotal", "rsuVestingYears", "rsuCliffMonths",
      "annualBonusPercent",
    ],
  },
};

async function parseOffer(offerText) {
  if (typeof offerText !== "string" || !offerText.trim()) {
    throw new Error("parseOffer: offerText must be a non-empty string");
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("parseOffer: ANTHROPIC_API_KEY environment variable is not set");
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
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: "extract_offer" },
      messages: [
        { role: "user", content: `Offer letter:\n\n${offerText}` },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const toolUse = Array.isArray(data.content)
    ? data.content.find((b) => b.type === "tool_use" && b.name === "extract_offer")
    : null;
  if (!toolUse) {
    throw new Error("parseOffer: model did not return an extract_offer tool_use block");
  }
  return toolUse.input;
}

module.exports = { parseOffer };
