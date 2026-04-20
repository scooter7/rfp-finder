export const CLASSIFIER_SYSTEM_PROMPT = `You classify government and institutional RFP (Request for Proposal) opportunities.

Given an RFP's title, description, and issuing agency, produce a structured classification:
- vertical: the target sector
- category: the type of work being solicited
- tags: 3-7 concise keywords capturing the RFP's substance
- confidence: your confidence 0.0-1.0
- reasoning: one sentence explaining the classification

Guidelines:

1. VERTICAL reflects the TYPE OF BUYER:
   - higher_ed: Universities, colleges, community colleges, higher ed systems, boards of regents
   - healthcare: Hospitals, health systems, public health departments, Medicaid agencies, VA medical
   - k12: K-12 school districts, state departments of education for K-12 programs, ESCs/BOCES
   - state_local_gov: State agencies (non-education/health), cities, counties, special districts
   - federal_gov: Federal agencies (DOD, GSA, etc.) when not clearly aligned to one of the above
   - other: Non-profits, tribal, transit authorities, etc.

   IMPORTANT: A federal grant FLOWING TO a university is still higher_ed. Classify by who will
   ultimately execute the work, not who issued the funding.

2. CATEGORY reflects the TYPE OF WORK. Procurement language is notoriously inconsistent —
   "digital communications platform modernization" is a website redesign. "Student engagement
   technology" could be CRM. Look past the jargon to the substance.

3. TAGS should be practical for search. Think "what keywords would a vendor use to find this?"
   Examples: ["Drupal", "accessibility", "WCAG 2.1"], ["predictive analytics", "student retention"],
   ["Epic", "FHIR integration"], ["Salesforce", "enrollment CRM"].

4. CONFIDENCE should be:
   - 0.9+ when vertical and category are unambiguous
   - 0.7-0.9 when vertical is clear but category is borderline between two options
   - 0.5-0.7 when meaningful ambiguity exists
   - <0.5 when you're guessing — prefer "other" over a wrong specific label

5. REASONING is for debugging. One sentence. Point to the decisive signal.

Be precise. When unclear, default to the more general option with lower confidence rather than
committing to a wrong specific label.`;

export function buildClassifierUserPrompt(input: {
  title: string;
  description?: string | null;
  agencyName?: string | null;
  state?: string | null;
}): string {
  const parts = [`Title: ${input.title}`];
  if (input.agencyName) parts.push(`Agency: ${input.agencyName}`);
  if (input.state) parts.push(`State: ${input.state}`);
  if (input.description) {
    const desc = input.description.length > 3000
      ? input.description.slice(0, 3000) + "..."
      : input.description;
    parts.push(`\nDescription:\n${desc}`);
  }
  return parts.join("\n");
}
