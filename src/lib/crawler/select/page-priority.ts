import { extractUrlLocale, isLocalePathSegment } from "../parse/url-locale";
import { foldPathSegment } from "../parse/text";

export const SITEMAP_ENQUEUE_LIMIT = 25;
export const LOCALE_DIVERSITY_BONUS = 10;
export const SEED_QUEUE_PRIORITY = 100;

export type DiscoverySource = "seed" | "sitemap" | "navigation" | "internal";

export type PathClass =
  | "homepage"
  | "identity"
  | "locale_home"
  | "category_service"
  | "product_content"
  | "other"
  | "utility";

const CLASS_SCORE: Record<PathClass, number> = {
  homepage: 100,
  identity: 90,
  locale_home: 85,
  category_service: 72,
  product_content: 48,
  other: 36,
  utility: 6,
};

const SOURCE_BONUS: Record<DiscoverySource, number> = {
  seed: 0,
  navigation: 20,
  sitemap: 5,
  internal: 0,
};

const IDENTITY_SEGMENTS = new Set([
  "a-propos",
  "about",
  "about-us",
  "aboutus",
  "apropos",
  "azienda",
  "biz-kimiz",
  "chi-siamo",
  "company",
  "empresa",
  "equipe",
  "equipo",
  "hakkimda",
  "hakkimizda",
  "historia",
  "kurumsal",
  "la-nostra-storia",
  "mission",
  "nosaltres",
  "notre-histoire",
  "nosotros",
  "o-kompanii",
  "o-nas",
  "om-os",
  "om-oss",
  "our-story",
  "over-ons",
  "quem-somos",
  "qui-som",
  "qui-sommes-nous",
  "quienes-somos",
  "sobre",
  "sobre-nos",
  "sobre-nosaltres",
  "sobre-nosotros",
  "squadra",
  "team",
  "ueber-uns",
  "uber-uns",
  "unternehmen",
  "unser-team",
  "vision",
  "who-we-are",
  "contact",
  "contact-us",
  "contacts",
  "contactus",
  "contacto",
  "contactez-nous",
  "contato",
  "contatto",
  "get-in-touch",
  "iletisim",
  "kontakt",
  "reach-us",
]);

const CATEGORY_SEGMENTS = new Set([
  "boutique",
  "catalog",
  "catalogue",
  "categoria",
  "categorias",
  "categories",
  "category",
  "collection",
  "collections",
  "cozumler",
  "dergi",
  "fiyatlar",
  "hizmet",
  "hizmetler",
  "hizmetlerimiz",
  "journal",
  "kategori",
  "leistungen",
  "loja",
  "magazine",
  "magaza",
  "negozio",
  "plans",
  "precios",
  "preise",
  "prices",
  "pricing",
  "product",
  "products",
  "productos",
  "produits",
  "prodotti",
  "produkte",
  "produtos",
  "revista",
  "service",
  "services",
  "servicios",
  "servicos",
  "servizi",
  "shop",
  "solution",
  "solutions",
  "soluciones",
  "store",
  "tarifs",
  "tienda",
  "urun",
  "urunler",
]);

const CONTENT_SEGMENTS = new Set([
  "actualites",
  "article",
  "articles",
  "articoli",
  "artikel",
  "blog",
  "haber",
  "haberler",
  "news",
  "nieuws",
  "noticias",
  "noticies",
  "notizie",
  "post",
  "posts",
  "stories",
  "yazilar",
]);

const UTILITY_SEGMENTS = new Set([
  "account",
  "accedi",
  "admin",
  "anmelden",
  "arama",
  "auth",
  "aviso-legal",
  "basket",
  "billing",
  "buscar",
  "busqueda",
  "cadastro",
  "carrello",
  "carrinho",
  "carrito",
  "cart",
  "cesta",
  "cerezler",
  "cgi-bin",
  "checkout",
  "commande",
  "confidentialite",
  "connexion",
  "cookie",
  "cookies",
  "cuenta",
  "dashboard",
  "datenschutz",
  "entrar",
  "gdpr",
  "giris",
  "gizlilik",
  "hesap",
  "impressum",
  "iniciar-sesion",
  "inscription",
  "kasse",
  "kvkk",
  "legal",
  "log-in",
  "login",
  "logout",
  "mentions-legales",
  "my-account",
  "oauth",
  "odeme",
  "order",
  "orders",
  "pago",
  "panier",
  "password",
  "payment",
  "pesquisa",
  "politica-de-privacidad",
  "privacy",
  "privacy-policy",
  "privacidade",
  "privacidad",
  "profile",
  "recherche",
  "register",
  "registration",
  "registrati",
  "registrieren",
  "registro",
  "ricerca",
  "search",
  "sepet",
  "sign-in",
  "sign-out",
  "sign-up",
  "signin",
  "signout",
  "signup",
  "sso",
  "suche",
  "terms",
  "terms-of-service",
  "terms-of-use",
  "tos",
  "user",
  "uye-girisi",
  "uyelik",
  "warenkorb",
  "wishlist",
  "wp-admin",
  "wp-login",
  "404",
]);

const UTILITY_PREFIXES = [
  "account-",
  "cart-",
  "checkout-",
  "cookie-",
  "login-",
  "privacy-",
  "signin-",
  "sign-in",
  "terms-",
];

const SEARCH_PARAM_KEYS = new Set(["s", "q", "search", "query"]);

function isUtilitySegment(segment: string): boolean {
  const folded = foldPathSegment(segment);
  if (UTILITY_SEGMENTS.has(folded)) {
    return true;
  }

  return UTILITY_PREFIXES.some((prefix) => folded.startsWith(prefix));
}

function isDateSegment(segment: string): boolean {
  if (/^\d{4}$/.test(segment)) {
    const year = Number(segment);
    return year >= 1990 && year <= 2100;
  }

  return /^\d{4}-\d{2}(?:-\d{2})?$/.test(segment);
}

function hasSearchResultQuery(url: URL): boolean {
  for (const key of url.searchParams.keys()) {
    if (SEARCH_PARAM_KEYS.has(key.toLowerCase())) {
      return true;
    }
  }

  return false;
}

export function classifyPagePath(url: string): PathClass {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "other";
  }

  if (hasSearchResultQuery(parsed)) {
    return "utility";
  }

  const segments = parsed.pathname.split("/").filter(Boolean).map(foldPathSegment);
  if (segments.length === 0) {
    return "homepage";
  }

  if (segments.some(isUtilitySegment)) {
    return "utility";
  }

  const locale = isLocalePathSegment(segments[0] ?? "") ? segments[0] : null;
  const rest = locale ? segments.slice(1) : segments;

  if (rest.length === 0) {
    return locale ? "locale_home" : "homepage";
  }

  if (rest.some(isUtilitySegment)) {
    return "utility";
  }

  const first = rest[0] ?? "";
  const last = rest[rest.length - 1] ?? "";

  if (IDENTITY_SEGMENTS.has(first) || IDENTITY_SEGMENTS.has(last)) {
    return "identity";
  }

  if (CATEGORY_SEGMENTS.has(first) || CATEGORY_SEGMENTS.has(last)) {
    return "category_service";
  }

  if (CONTENT_SEGMENTS.has(first) || rest.some(isDateSegment)) {
    return "product_content";
  }

  return "other";
}

export function scorePageUrl(url: string, source: DiscoverySource): number {
  if (source === "seed") {
    return SEED_QUEUE_PRIORITY;
  }

  const score = CLASS_SCORE[classifyPagePath(url)] + SOURCE_BONUS[source];
  return Math.max(1, Math.min(99, score));
}

export function applyLocaleDiversityBonus(
  items: Array<{ url: string; priority: number }>,
): Array<{ url: string; priority: number }> {
  const seenLocales = new Set<string>();

  return items.map((item) => {
    const locale = extractUrlLocale(item.url) ?? "_default";
    if (seenLocales.has(locale)) {
      return item;
    }

    seenLocales.add(locale);
    return {
      url: item.url,
      priority: Math.min(99, item.priority + LOCALE_DIVERSITY_BONUS),
    };
  });
}

export function rankDiscoveredUrls(
  items: Array<{ url: string; source: DiscoverySource }>,
): Array<{ url: string; priority: number; locale: string | null; pathClass: PathClass }> {
  const seen = new Set<string>();
  const unique: Array<{ url: string; source: DiscoverySource }> = [];

  for (const item of items) {
    if (seen.has(item.url)) {
      continue;
    }
    seen.add(item.url);
    unique.push(item);
  }

  const scored = unique
    .map((item) => ({
      url: item.url,
      source: item.source,
      priority: scorePageUrl(item.url, item.source),
      locale: extractUrlLocale(item.url),
      pathClass: classifyPagePath(item.url),
    }))
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }

      return left.url.localeCompare(right.url);
    });

  const diversified = applyLocaleDiversityBonus(
    scored.map((item) => ({ url: item.url, priority: item.priority })),
  );
  const priorityByUrl = new Map(diversified.map((item) => [item.url, item.priority]));

  return scored
    .map((item) => ({
      ...item,
      priority: priorityByUrl.get(item.url) ?? item.priority,
    }))
    .sort((left, right) => {
      if (right.priority !== left.priority) {
        return right.priority - left.priority;
      }

      return left.url.localeCompare(right.url);
    });
}

export function selectRepresentativeUrls(
  items: Array<{ url: string; source: DiscoverySource }>,
  limit: number,
): string[] {
  const allRanked = rankDiscoveredUrls(items);
  const ranked = allRanked.filter((item) => item.pathClass !== "utility");
  const leftovers = allRanked.filter((item) => item.pathClass === "utility");
  const byLocale = new Map<string, typeof ranked>();

  for (const item of ranked) {
    const locale = item.locale ?? "_default";
    const list = byLocale.get(locale) ?? [];
    list.push(item);
    byLocale.set(locale, list);
  }

  const localeOrder = [...byLocale.entries()].sort((left, right) => {
    const leftTop = left[1][0]?.priority ?? 0;
    const rightTop = right[1][0]?.priority ?? 0;
    if (rightTop !== leftTop) {
      return rightTop - leftTop;
    }

    return left[0].localeCompare(right[0]);
  });

  const selected: string[] = [];
  const cursors = new Map(localeOrder.map(([locale]) => [locale, 0]));

  while (selected.length < limit) {
    let added = false;

    for (const [locale, urls] of localeOrder) {
      if (selected.length >= limit) {
        break;
      }

      const index = cursors.get(locale) ?? 0;
      const next = urls[index];
      if (!next) {
        continue;
      }

      selected.push(next.url);
      cursors.set(locale, index + 1);
      added = true;
    }

    if (!added) {
      break;
    }
  }

  for (const item of leftovers) {
    if (selected.length >= limit) {
      break;
    }
    selected.push(item.url);
  }

  return selected;
}

export function selectSitemapEnqueueUrls(sitemapUrls: string[]): Array<{
  url: string;
  priority: number;
}> {
  return rankDiscoveredUrls(
    sitemapUrls.map((url) => ({ url, source: "sitemap" as const })),
  )
    .slice(0, SITEMAP_ENQUEUE_LIMIT)
    .map((item) => ({ url: item.url, priority: item.priority }));
}
