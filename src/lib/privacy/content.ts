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
    body: "If you choose Connect Google, Foundfy asks Google for read-only Search Console access and stores your Google account identifier and email so it can remember that connection. Foundfy also stores an encrypted refresh token on the server so it can keep that connection. You can then confirm which Search Console property belongs to this site. If you choose to set up Search Console, Foundfy asks for additional permission to add a Search Console property for your website and to request Google ownership verification. Foundfy does not change your DNS; you add the verification record yourself. Search performance data from Search Console is used to provide Foundfy functionality. When you sync Google search data, Foundfy may store private search-performance evidence for that property, such as impressions, clicks, CTR, average position, pages, and queries Google reported. Foundfy may also derive prioritized next actions from that connected private Google Search evidence. The connected owner can also ask Foundfy to include a Google-visible page in a later website crawl. This evidence, those derived actions, and those page-analysis requests are only visible to the connected owner. A private session cookie remembers that you are the Google account that connected this site. Knowing a site link is not enough to see that Google account information. You can disconnect, which revokes Foundfy’s Google access when possible, deletes stored Search Console performance evidence, deletes derived next actions that used that evidence, deletes Google Search comparisons stored after a verified change, stops unfinished page-analysis requests that depended on Search Console, and deletes the stored token. Foundfy keeps crawl and site-understanding data, and it keeps the record that an approved change was executed or verified, without retaining Google performance numbers.",
  },
  {
    title: "What we store",
    body: "Crawl data and analysis results are stored so you can return to scan history. If you join the early access list, Foundfy stores your email and the fields you submit: role, interest, and an optional website. These details are stored in Foundfy's database, hosted by Supabase, and are also sent by email to the Foundfy team through Resend, an email delivery service, so the team can handle your early access request.",
  },
  {
    title: "AI explanations (OpenAI)",
    body: "Foundfy uses OpenAI automatically. When a completed analysis is opened, Foundfy sends OpenAI the website's hostname, the number of pages analyzed, and limited evidence about the highlighted findings, such as each finding's title and description, page addresses, status codes, redirects, page titles, meta descriptions, canonical and indexing directives, link details, and sitemap or robots.txt details, to generate plain-language explanations. When a website's page in Foundfy is opened, Foundfy sends OpenAI the website address and what the analysis found on its pages, such as page addresses, titles, headings, text excerpts of up to 1,000 characters per page, navigation labels, languages, and structured-data types, to generate a draft interpretation of the website. You do not need to request either: the optional Explain further button only displays an explanation that has already been generated. The generated explanations and interpretations are stored with the analysis.",
  },
  {
    title: "Questions and deletion",
    body: "To ask a question or request deletion, email hello@foundfy.me.",
  },
] as const;
