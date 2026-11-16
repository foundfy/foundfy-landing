// Copy for the public landing page. Every locale provides the same shape, so a
// missing Spanish string is a type error rather than a silent English fallback.
// Optional fields (section ids, example notes) only render when a locale sets them.

export type LinkCopy = { href: string; label: string };

export type LabelValue = { label: string; value: string };

export type FourOf<T> = readonly [T, T, T, T];

export type LandingCopy = {
  meta: {
    title: string;
    description: string;
    ogLocale: string;
  };
  a11y: {
    logoLabel: string;
    logoHref: string;
    backToTop: string;
    primaryNav: string;
  };
  hero: {
    navLinks: readonly LinkCopy[];
    signIn: LinkCopy | null;
    getStarted: LinkCopy;
    announcement: { badge: string; text: string; href: string };
    headline: { firstLine: string; highlight: string };
    description: { lead: string; tail: string };
    offer: readonly string[];
    proof: FourOf<string>;
    scroll: string;
    /** The website input in the hero. Analysis progress and results are not localized yet. */
    analysisEntry: {
      placeholders: readonly string[];
      submit: string;
      inputLabel: string;
      invalidWebsite: string;
    };
  };
  whatWeBuilding: {
    sectionId?: string;
    eyebrow: string;
    heading: readonly [string, string];
    supporting: string;
    features: FourOf<{ label: string; description: string; detail: string }>;
    footer: readonly [string, string];
  };
  whyNow: {
    eyebrow: string;
    headline: readonly [string, string];
    supporting: string;
    cards: FourOf<{ title: string; description: string }>;
    statements: readonly [string, string, string];
  };
  productFlow: {
    sectionId?: string;
    eyebrow: string;
    heading: { before: string; accent: string; after: string };
    supporting: string;
    exampleNote?: string;
    observe: {
      title: string;
      body: string;
      panelLabel: string;
      panelHead: readonly [string, string];
      rows: readonly (LabelValue & { accent?: boolean })[];
    };
    decide: {
      title: string;
      body: string;
      panelLabel: string;
      chip: string;
      why: string;
      panelTitle: string;
      fields: readonly LabelValue[];
    };
    act: {
      title: string;
      body: string;
      panelLabel: string;
      lifecycle: FourOf<string>;
      previewLabel: string;
      previewPage: string;
      current: LabelValue;
      proposed: LabelValue;
      verification: LabelValue;
    };
  };
  capabilityGrid: {
    sectionId?: string;
    eyebrow: string;
    heading: string;
    supporting: string;
    exampleNote?: string;
    visibility: {
      kicker: string;
      title: string;
      head: readonly [string, string];
      pages: readonly { path: string; detail: string }[];
    };
    content: {
      kicker: string;
      title: string;
      query: string;
      leadingPage: LabelValue;
      demand: LabelValue;
      note: string;
    };
    technical: {
      kicker: string;
      title: string;
      items: readonly LabelValue[];
    };
    ai: { kicker: string; title: string; ahead: string; text: string };
    execution: {
      kicker: string;
      title: string;
      actions: readonly [string, string, string];
    };
    verification: {
      kicker: string;
      title: string;
      expected: LabelValue;
      observed: LabelValue;
      match: string;
    };
  };
  earlyAccess: EarlyAccessFormCopy;
  closing: {
    /** `lead` renders in white, `accent` in orange; `tail` is an optional third line. */
    headline: { lead: string; accent: string; tail?: string };
    footerText: string;
  };
  footer: {
    privacy: LinkCopy;
  };
};

export type EarlyAccessText = {
  heading: string;
  body: string;
  /** `{host}` is replaced with the analyzed hostname. */
  personalizedHeading: string;
  personalizedBody: string;
  successHeadline: string;
  successSubline: string;
  /** `{host}` is replaced with the analyzed hostname. */
  personalizedSuccessSubline: string;
};

export type EarlyAccessFormCopy = {
  eyebrow: string;
  text: EarlyAccessText;
  helloPrefix: string;
  selectPlaceholder: string;
  questions: {
    role: string;
    interest: string;
    website: string;
    websiteSummary: string;
    email: string;
  };
  roles: Record<"business-owner" | "seo-professional" | "agency" | "other", string>;
  interests: Record<"seo" | "ai" | "content" | "technical" | "all", string>;
  websitePlaceholder: string;
  websiteLabel: string;
  emailPlaceholder: string;
  emailLabel: string;
  next: string;
  continueLabel: string;
  skipLabel: string;
  back: string;
  backLabel: string;
  submit: string;
  submitting: string;
  errors: {
    websiteInvalid: string;
    emailInvalid: string;
    generic: string;
    /** null keeps the server's own message; a string replaces it. */
    server: string | null;
  };
};
