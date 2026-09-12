export const PRIVACY_PAGE_TITLE = "Privacy";

export const PRIVACY_INTRO =
  "Foundfy is in private beta. This page describes what happens when you use the current product.";

export const PRIVACY_SECTIONS = [
  {
    title: "Website analysis",
    body: "When you submit a URL, Foundfy processes that address and fetches publicly accessible on-page content from it, such as HTML a visitor could open in a browser. This is not a full-site audit. Each analysis covers a limited number of pages. Foundfy does not measure your rankings or visibility in Google, ChatGPT, Gemini, Perplexity, or other search engines.",
  },
  {
    title: "What we store",
    body: "Crawl data and analysis results are stored so you can return to scan history. If you join the early access list, Foundfy stores your email and the fields you submit: role, interest, and an optional website.",
  },
  {
    title: "Explain further",
    body: "If you use optional Explain further, limited finding evidence may be sent to OpenAI to generate that explanation.",
  },
  {
    title: "Questions and deletion",
    body: "To ask a question or request deletion, email hello@foundfy.me.",
  },
] as const;
