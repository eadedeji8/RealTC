import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function generateNegotiationEmail(parsedOffer: unknown): Promise<string> {
  const system = `You are a career coach helping a first-generation professional negotiate a job offer.

Write a respectful, professional negotiation email that:
- References specific numbers from the offer (base salary, current sign-on bonus, RSU value, total comp)
- Asks for an INCREASE to the SIGN-ON BONUS (not RSUs — sign-on is guaranteed cash, RSUs depend on stock price and vesting; cash is more secure for someone without family financial backing)
- Justifies the ask with research, competing factors, or relocation/transition costs
- Maintains a warm, collaborative tone — not adversarial
- Expresses genuine enthusiasm for the role and company
- Keeps it concise (under 250 words in the email body)
- Does NOT mention being first-generation or financial vulnerability — frame the ask in standard professional terms

Return ONLY the email text (subject line + body). No preamble, no explanation, no markdown fences.`;

  const userMessage = `Here is the parsed offer JSON. Write the negotiation email tailored to these specific numbers:

${JSON.stringify(parsedOffer, null, 2)}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  for (const block of response.content) {
    if (block.type === "text") {
      return block.text.trim();
    }
  }

  throw new Error("No text content in Claude response");
}
