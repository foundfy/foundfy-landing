export const PRIVACY_PAGE_TITLE = "Privacy";

export const PRIVACY_INTRO =
  "Foundfy is in private beta. This page describes what happens when you use the current product.";

export const PRIVACY_SECTIONS = [
  {
    title: "Website analysis",
    body: "When you submit a URL, Foundfy processes that address and fetches publicly accessible on-page content from it, such as HTML a visitor could open in a browser. This is not a full-site audit. Each analysis covers a limited number of pages. Foundfy does not measure your rankings or visibility in Google, ChatGPT, Gemini, Perplexity, or other search engines.",
  },
  {
    title: "Google account",
    body: "If you choose Connect Google, Foundfy asks Google for read-only Search Console access and stores your Google account identifier and email so it can remember that connection. Foundfy also stores an encrypted refresh token on the server so it can keep that connection. This does not import Search Console performance data yet. A private session cookie remembers that you are the Google account that connected this site. Knowing a site link is not enough to see that Google account information. You can disconnect, which revokes Foundfy’s Google access when possible and deletes the stored token. Crawl and site-understanding data are kept.",
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
