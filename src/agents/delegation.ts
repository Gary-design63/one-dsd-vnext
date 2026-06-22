// =====================================================================
// One DSD vNext — delegation routing (Layer 10) — PURE.
// The Chief of Staff classifies a need to the right "hat" (persona). Routing
// is transparent and rule-based (keyword/theme → persona), so it is testable
// and explainable — no opaque guessing. Unknown needs route to the Chief of
// Staff to triage (never dropped).
// =====================================================================
export type PersonaKey =
  | "chief_of_staff" | "strategy" | "insight" | "learning_architect"
  | "change_adoption" | "ombuds_care" | "compliance_risk";

export interface Need {
  text: string;
  themeKey?: string | null;   // program_themes key, if known
}

const RULES: { persona: Exclude<PersonaKey, "chief_of_staff">; patterns: RegExp }[] = [
  { persona: "ombuds_care", patterns: /\b(harass|microaggression|conflict|distress|burnout|safety|complaint|exclusion)\b/i },
  { persona: "compliance_risk", patterns: /\b(eeoc|ada|olmstead|508|legal|compliance|policy|regulat|accommodation request)\b/i },
  { persona: "insight", patterns: /\b(data|metric|trend|representation|survey|gap|participation|analy[sz]e|dashboard)\b/i },
  { persona: "learning_architect", patterns: /\b(learn|course|module|curriculum|training|path|mentor|career)\b/i },
  { persona: "change_adoption", patterns: /\b(roll ?out|adopt|stakeholder|resist|change|collaborat|team)\b/i },
  { persona: "strategy", patterns: /\b(strateg|roadmap|priorit|plan|vision|leadership)\b/i },
];

const THEME_PERSONA: Record<string, Exclude<PersonaKey, "chief_of_staff">> = {
  wellbeing_psych_safety: "ombuds_care",
  service_delivery_equity: "compliance_risk",
  workplace_equity: "insight",
  workforce_equity_inclusion: "insight",
  leadership_development: "strategy",
  cross_team_collaboration: "change_adoption",
  intercultural_practice: "learning_architect",
  career_dev_mentorship: "learning_architect",
};

export interface Routing {
  persona: PersonaKey;
  rationale: string;
}

export function choosePersona(need: Need): Routing {
  if (need.themeKey && THEME_PERSONA[need.themeKey]) {
    return { persona: THEME_PERSONA[need.themeKey]!, rationale: `theme:${need.themeKey}` };
  }
  for (const r of RULES) {
    if (r.patterns.test(need.text)) {
      return { persona: r.persona, rationale: `matched ${r.persona} keywords` };
    }
  }
  return { persona: "chief_of_staff", rationale: "no clear match — Chief of Staff triages" };
}
