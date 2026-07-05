/**
 * Zero-cost client-side intent classifier.
 *
 * Every prompt is scored against a fixed set of regex rules before a single
 * API token is spent. The first matching profile (in priority order) wins.
 * Order runs from most specific to least specific; "generalEnquiry" is the
 * catch-all at the bottom.
 */

export const TASK_PROFILES = {
  yagniReview: {
    id: "yagniReview",
    label: "YAGNI Code Review (Lazy Code Review)",
    model: "claude-sonnet-4-6",
    maxTokens: 2500,
    pattern:
      /\b(yagni|refactor|de-?duplicat|dead code|over-?engineer|speculative abstraction|clean\s?up (this|the) code|simplify (this|the) code|lazy review)\b/i,
    extraSystemInstruction:
      "Apply a strict YAGNI ladder to the supplied code. Walk it top to bottom and flag, then remove: speculative abstractions with a single caller, redundant helper libraries that duplicate a one-line native operation, unused exports, dead branches, and configuration options nothing reads. Every deletion needs a one-line reason. Do not add new abstractions to justify the review.",
  },

  dbArchitecture: {
    id: "dbArchitecture",
    label: "DB Architecture",
    model: "claude-sonnet-4-6",
    maxTokens: 2000,
    pattern:
      /\b(database schema|db schema|erd|entity relationship|postgres|mysql|mongodb|sql schema|normali[sz]e|foreign key|index(ing)? strategy)\b/i,
  },

  mobileAppDev: {
    id: "mobileAppDev",
    label: "Mobile App Code Development",
    model: "claude-sonnet-4-6",
    maxTokens: 4000,
    pattern: /\b(ios app|android app|react native|flutter|swift ?ui|kotlin|jetpack compose|mobile app)\b/i,
  },

  websiteDesign: {
    id: "websiteDesign",
    label: "Website Design",
    model: "claude-sonnet-4-6",
    maxTokens: 3000,
    pattern: /(?=.*\b(website|web ?page|landing page)\b)(?=.*\b(design|layout|build|mock ?up)\b)/i,
    extraSystemInstruction:
      "Use native HTML5 elements only, no component frameworks. Style exclusively with Tailwind utility classes, no custom CSS files and no inline style attributes.",
  },

  errorTroubleshooting: {
    id: "errorTroubleshooting",
    label: "Error Troubleshooting",
    model: "claude-sonnet-4-6",
    maxTokens: 1500,
    pattern: /\b(stack ?trace|traceback|exception|error:|errno|segfault|crash(es|ing)?|won'?t (build|run|compile)|is (failing|broken))\b/i,
  },

  packageUpgrades: {
    id: "packageUpgrades",
    label: "Package Upgrades",
    model: "claude-haiku-4-5-20251001",
    maxTokens: 500,
    pattern: /\b(upgrade|update|bump)\b.*\b(package|dependenc(y|ies)|npm|pip|library|libraries|version)\b/i,
  },

  documentReviewFlashcards: {
    id: "documentReviewFlashcards",
    label: "Document Review / Flashcards",
    model: "claude-sonnet-4-6",
    maxTokens: 2000,
    pattern: /\b(flash ?cards?|review this document|summari[sz]e this (document|pdf|paper)|study cards?)\b/i,
  },

  logoDesigns: {
    id: "logoDesigns",
    label: "Logo Designs",
    model: "claude-haiku-4-5-20251001",
    maxTokens: 800,
    pattern: /\blogo(s)?\b/i,
  },

  creatingImage: {
    id: "creatingImage",
    label: "Creating Image",
    model: "claude-haiku-4-5-20251001",
    maxTokens: 500,
    pattern: /\b(generate|create|draw|make)\b.*\b(image|picture|illustration|artwork|icon set|graphic)\b/i,
  },

  structuringPrompt: {
    id: "structuringPrompt",
    label: "Structuring / Rephrasing Prompt",
    model: "claude-haiku-4-5-20251001",
    maxTokens: 600,
    pattern: /\b(rephrase|reword|restructure|tighten|rewrite)\b.*\bprompt\b/i,
  },

  creatingDocumentation: {
    id: "creatingDocumentation",
    label: "Creating Documentation",
    model: "claude-haiku-4-5-20251001",
    maxTokens: 1500,
    pattern: /\b(write|generate|draft)\b.*\b(documentation|readme|docstrings?|api docs|changelog)\b/i,
  },

  codeDevWebApp: {
    id: "codeDevWebApp",
    label: "Code Development Web App",
    model: "claude-sonnet-4-6",
    maxTokens: 4000,
    pattern: /\b(web app|webapp|react|vue|next\.?js|express|node\.?js|full-?stack|backend|api endpoint|rest api)\b/i,
  },

  generalEnquiry: {
    id: "generalEnquiry",
    label: "General Enquiry",
    model: "claude-haiku-4-5-20251001",
    maxTokens: 400,
    pattern: /.*/,
  },
};

// Priority order: specific rules first, generalEnquiry is the fallback.
const PRIORITY = [
  "yagniReview",
  "dbArchitecture",
  "mobileAppDev",
  "websiteDesign",
  "errorTroubleshooting",
  "packageUpgrades",
  "documentReviewFlashcards",
  "logoDesigns",
  "creatingImage",
  "structuringPrompt",
  "creatingDocumentation",
  "codeDevWebApp",
  "generalEnquiry",
];

/**
 * Classify raw prompt text against the task profile matrix.
 * Costs zero API tokens — pure local regex matching.
 * @param {string} rawPrompt
 * @returns {typeof TASK_PROFILES[keyof typeof TASK_PROFILES]}
 */
export function classifyIntent(rawPrompt) {
  const text = rawPrompt || "";
  for (const key of PRIORITY) {
    const profile = TASK_PROFILES[key];
    if (profile.pattern.test(text)) return profile;
  }
  return TASK_PROFILES.generalEnquiry;
}
