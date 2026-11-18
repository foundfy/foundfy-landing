import type { LandingCopy } from "./types";

// English landing copy. These strings are the existing English experience,
// moved here unchanged; the browser checks compare English against main.
export const EN_LANDING_COPY = {
  meta: {
    title: "Foundfy | Be found wherever people search.",
    description:
      "Foundfy turns on-page SEO insights into clear actions. Built for a world where people search in more places.",
    ogLocale: "en_US",
  },
  a11y: {
    logoLabel: "Foundfy — refresh page",
    logoHref: "/",
    backToTop: "Back to top",
    primaryNav: "Primary",
  },
  hero: {
    navLinks: [
      { href: "/product", label: "Product" },
      { href: "/pricing", label: "Pricing" },
      { href: "/changelog", label: "Changelog" },
      { href: "/resources", label: "Resources" },
    ],
    signIn: { href: "/sign-in", label: "Sign in" },
    getStarted: { href: "#early-access", label: "Get started" },
    announcement: {
      badge: "New",
      text: "Execute and verify approved changes",
      href: "/changelog",
    },
    headline: { firstLine: "Be found wherever", highlight: "people search." },
    description: {
      lead: "A simpler way to understand your search visibility",
      tail: "and make the right changes happen.",
    },
    offer: ["Free for one website", "Up to 10 pages", "No credit card required"],
    proof: ["Google search", "AI search", "Content opportunities", "Technical actions"],
    scroll: "Scroll",
    analysisEntry: {
      placeholders: ["yourwebsite.com", "acme.com", "foundfy.me", "yourbrand.io"],
      submit: "Analyze",
      inputLabel: "Website URL",
      invalidWebsite: "Enter a valid website, such as example.com.",
    },
  },
  whatWeBuilding: {
    eyebrow: "How Foundfy works",
    heading: ["Know what matters.", "Know what to do next."],
    supporting:
      "Foundfy reviews your website, finds what matters, and turns search signals into clear actions you can move forward with.",
    features: [
      {
        label: "Find",
        description: "See what's holding you back.",
        detail: "Crawl your site and uncover what's blocking visibility.",
      },
      {
        label: "Understand",
        description: "Know what matters and why.",
        detail: "Combine site evidence with search data to see what matters.",
      },
      {
        label: "Improve",
        description: "Turn priorities into approved changes.",
        detail: "Preview, approve, and move the right changes forward.",
      },
      {
        label: "Stay ahead",
        description: "Verify what changed and keep adapting.",
        detail: "Recheck, verify, and keep adapting as search changes.",
      },
    ],
    footer: ["Search changes.", "Foundfy changes with it."],
  },
  whyNow: {
    eyebrow: "Why now",
    headline: ["Search is changing.", "So are we."],
    supporting:
      "People discover brands in more ways than ever. Foundfy is designed for this new era — starting with on-page SEO, and building toward AI search.",
    cards: [
      { title: "SEO insights", description: "See what's working and what's not." },
      {
        title: "Content opportunities",
        description: "Find new ideas that match real intent.",
      },
      {
        title: "Technical checks",
        description: "Catch issues before they hold you back.",
      },
      {
        title: "AI search, ahead",
        description: "We're building toward how brands show up in AI search.",
      },
    ],
    statements: ["More platforms", "New behaviors", "Bigger opportunities"],
  },
  productFlow: {
    eyebrow: "The loop",
    heading: { before: "From signal to ", accent: "verified", after: " change." },
    supporting:
      "Foundfy does not stop at findings. It connects evidence to a decision, helps execute the approved change, then verifies the result.",
    observe: {
      title: "Observe",
      body: "Foundfy combines crawl evidence, Google Search Console data, and what the site is trying to do.",
      panelLabel: "Example search and crawl evidence",
      panelHead: ["Google Search evidence", "Last 28 days"],
      rows: [
        { label: "Query", value: "getting started guide" },
        { label: "Page", value: "/guides/getting-started" },
        { label: "Impressions", value: "1,240" },
        { label: "Clicks", value: "86" },
        { label: "Match", value: "Exact page", accent: true },
        { label: "Crawl evidence", value: "Missing meta description" },
      ],
    },
    decide: {
      title: "Decide",
      body: "Foundfy turns that evidence into one prioritized decision.",
      panelLabel: "Example prioritized decision",
      chip: "Do first",
      why: "Why this?",
      panelTitle: "Add a meta description on /guides/getting-started",
      fields: [
        {
          label: "Why it matters",
          value:
            "This page already receives Google visibility and has no meta description.",
        },
        {
          label: "Website evidence",
          value: "Missing meta description on a crawled page.",
        },
        {
          label: "Goal context",
          value: "Prioritize pages that already show up before suggesting new content.",
        },
        {
          label: "Evidence period",
          value: "Last 28 days · 1,240 appearances · 86 visits",
        },
      ],
    },
    act: {
      title: "Act and verify",
      body: "The approved change moves from a preview to the page. Foundfy then re-checks that it is live.",
      panelLabel: "Example action from preview to verification",
      lifecycle: ["Prepared", "Approved", "Executed", "Verified"],
      previewLabel: "Exact change · Update meta description",
      previewPage: "/guides/getting-started",
      current: { label: "Current", value: "None" },
      proposed: {
        label: "Proposed",
        value: "A practical guide for the search that already reaches this page.",
      },
      verification: {
        label: "Verification",
        value:
          "Verified. Foundfy re-checked the page and the meta description matches the approved change.",
      },
    },
  },
  capabilityGrid: {
    eyebrow: "Capabilities",
    heading: "Everything you need to move search forward.",
    supporting:
      "The same signals Foundfy already uses: search evidence, site evidence, a decision, and a check that the change landed.",
    visibility: {
      kicker: "Search visibility",
      title: "Queries, landing pages, clicks, and impressions.",
      head: ["Google Search", "Last 28 days"],
      pages: [
        { path: "/guides/getting-started", detail: "1,240 impressions · 86 clicks" },
        { path: "/pricing", detail: "640 impressions · 41 clicks" },
        { path: "/", detail: "210 impressions · 28 clicks" },
      ],
    },
    content: {
      kicker: "Content opportunities",
      title: "Grounded in real search demand and intent.",
      query: "getting started guide",
      leadingPage: { label: "Leading page", value: "/guides/getting-started" },
      demand: { label: "Demand", value: "1,240 appearances · 86 visits" },
      note: "Review this opportunity",
    },
    technical: {
      kicker: "Technical actions",
      title: "Canonicals, metadata, indexability, internal linking, crawl issues.",
      items: [
        { label: "Canonical", value: "/es/guide points elsewhere" },
        { label: "Metadata", value: "Missing meta description" },
        { label: "Indexability", value: "Page is in the crawl" },
        { label: "Internal links", value: "Thin path to this page" },
      ],
    },
    ai: {
      kicker: "AI search",
      title: "Visibility beyond traditional search.",
      ahead: "Ahead",
      text: "Building toward how this site shows up when people ask an assistant.",
    },
    execution: {
      kicker: "Execution",
      title: "Prepare, preview, approve, apply.",
      actions: ["Prepare this change", "Approve", "Apply this change"],
    },
    verification: {
      kicker: "Verification",
      title: "Re-crawl and confirm that the change actually happened.",
      expected: { label: "Expected", value: "Approved meta description" },
      observed: { label: "Observed", value: "Same description on the fresh crawl" },
      match: "Verified · page matches",
    },
  },
  earlyAccess: {
    eyebrow: "Get early access",
    text: {
      heading: "Tell us a bit about yourself.",
      body: "Join the early access list and help shape what's next. We're building Foundfy with the people who'll use it most.",
      personalizedHeading: "Let's work on {host}.",
      personalizedBody:
        "Answer a few quick questions and we'll get back to you by email about next steps.",
      successHeadline: "YOU'RE EARLY.",
      successSubline: "We'll let you know when there's more to discover.",
      personalizedSuccessSubline: "We'll email you about {host}.",
    },
    helloPrefix: "Or just say hello",
    selectPlaceholder: "Select one",
    questions: {
      role: "What best describes you?",
      interest: "What are you most interested in?",
      website: "Your website (optional)",
      websiteSummary: "Website",
      email: "Where should we keep you posted?",
    },
    roles: {
      "business-owner": "Business / Brand",
      "seo-professional": "SEO Professional",
      agency: "Agency",
      other: "Other",
    },
    interests: {
      seo: "SEO insights",
      ai: "AI visibility",
      content: "Content opportunities",
      technical: "Technical checks",
      all: "All of the above",
    },
    websitePlaceholder: "https://",
    websiteLabel: "Your website (optional)",
    emailPlaceholder: "you@company.com",
    emailLabel: "Your email",
    next: "Next",
    continueLabel: "Continue",
    skipLabel: "Skip website and continue",
    back: "Back",
    backLabel: "Go back to previous question",
    submit: "Get early access",
    submitting: "Submitting…",
    errors: {
      websiteInvalid: "Enter a valid website, or leave this blank.",
      emailInvalid: "Please enter a valid email address.",
      generic: "Something went wrong. Please try again.",
      server: null,
    },
  },
  closing: {
    headline: { lead: "Found today.", accent: "Further", tail: "tomorrow." },
    footerText: "Be found wherever people search.",
    sectionFooterLogo: false,
  },
  footer: {
    privacy: { href: "/privacy", label: "Privacy" },
  },
  notFound: {
    metaTitle: "Page not found | Foundfy",
    heading: "This page doesn't exist.",
    body: "The link may be broken, or the page may have moved.",
    homeLink: { href: "/", label: "Go to the home page" },
  },
} as const satisfies LandingCopy;
