import type { LandingCopy } from "./types";

// Spanish (Spain) landing copy, approved by the product owner.
// Rules: tuteo; describe today's assisted service precisely (Foundfy proposes,
// the owner approves, publication is assisted, Foundfy verifies); AI search is
// marked as upcoming; the example panels are labelled as illustrative and use
// impressions/clicks consistently; no price figure.
export const ES_LANDING_COPY = {
  meta: {
    title: "Foundfy | Que te encuentren, busquen donde busquen.",
    description:
      "Foundfy revisa tu web, te dice qué mejorar primero y te ayuda a publicarlo y verificarlo. SEO claro para pequeñas empresas.",
    ogLocale: "es_ES",
  },
  a11y: {
    logoLabel: "Foundfy — recargar la página",
    logoHref: "/es",
    backToTop: "Volver arriba",
    primaryNav: "Principal",
  },
  hero: {
    navLinks: [
      { href: "#como-funciona", label: "Cómo funciona" },
      { href: "#el-proceso", label: "El proceso" },
      { href: "#capacidades", label: "Capacidades" },
    ],
    signIn: null,
    getStarted: { href: "#early-access", label: "Solicitar una revisión" },
    announcement: {
      badge: "Nuevo",
      text: "Cambios aprobados y verificados",
      href: "#el-proceso",
    },
    headline: { firstLine: "Que te encuentren,", highlight: "busquen donde busquen." },
    description: {
      lead: "Foundfy analiza tu web, identifica qué mejorar y te ayuda a poner en marcha los cambios.",
      tail: "Sin que tengas que ser experto en SEO.",
    },
    offer: ["Análisis inicial gratuito", "Hasta 10 páginas", "Sin tarjeta de crédito"],
    proof: [
      "Búsqueda en Google",
      "Búsqueda con IA (próximamente)",
      "Oportunidades de contenido",
      "Acciones técnicas",
    ],
    scroll: "Desliza",
  },
  whatWeBuilding: {
    sectionId: "como-funciona",
    eyebrow: "Cómo funciona Foundfy",
    heading: ["Descubre qué mejorar.", "Y por dónde empezar."],
    supporting:
      "Foundfy revisa tu web, encuentra lo que importa y lo convierte en acciones claras para avanzar.",
    features: [
      {
        label: "Encuentra",
        description: "Detecta qué puede estar limitando tu visibilidad.",
        detail: "Analizamos tu web y te mostramos lo que hemos encontrado.",
      },
      {
        label: "Entiende",
        description: "Qué importa y por qué.",
        detail: "Cruzamos lo que vemos en tu web con tus datos de búsqueda.",
      },
      {
        label: "Mejora",
        description: "Convierte las prioridades en cambios aprobados.",
        detail: "Revisa la propuesta, apruébala y te ayudamos a publicarla.",
      },
      {
        label: "Comprueba los resultados",
        description: "Verifica los cambios y sigue mejorando.",
        detail:
          "Comprobamos que los cambios se han publicado correctamente y utilizamos nueva información para identificar los siguientes pasos.",
      },
    ],
    footer: ["La búsqueda cambia.", "Foundfy cambia con ella."],
  },
  whyNow: {
    eyebrow: "Por qué ahora",
    headline: ["La búsqueda está cambiando.", "Nosotros también."],
    supporting:
      "La gente descubre marcas de más formas que nunca. Foundfy está pensado para esta nueva etapa: empezamos por el SEO de tu web y avanzamos hacia la búsqueda con IA.",
    cards: [
      { title: "Diagnóstico SEO", description: "Mira qué funciona y qué no." },
      {
        title: "Oportunidades de contenido",
        description: "Ideas nuevas basadas en lo que la gente busca de verdad.",
      },
      {
        title: "Revisión técnica",
        description: "Detecta problemas antes de que te frenen.",
      },
      {
        title: "Búsqueda con IA, en camino",
        description:
          "Estamos trabajando en cómo aparecen las marcas en las búsquedas con IA.",
      },
    ],
    statements: ["Más plataformas", "Nuevos hábitos", "Más oportunidades"],
  },
  productFlow: {
    sectionId: "el-proceso",
    eyebrow: "El proceso",
    heading: { before: "De la señal al cambio ", accent: "verificado", after: "." },
    supporting:
      "Foundfy no se queda en los hallazgos. Conecta la evidencia con una decisión, te ayuda a publicar el cambio que apruebas y después verifica el resultado.",
    exampleNote: "Datos de ejemplo, con fines ilustrativos.",
    observe: {
      title: "Observar",
      body: "Foundfy combina el análisis de tu web, los datos de Google Search Console y los objetivos de tu negocio.",
      panelLabel: "Ejemplo de datos de búsqueda y del análisis",
      panelHead: ["Datos de Google Search", "Últimos 28 días"],
      rows: [
        { label: "Búsqueda", value: "guía para empezar" },
        { label: "Página", value: "/guias/primeros-pasos" },
        { label: "Impresiones", value: "1.240" },
        { label: "Clics", value: "86" },
        { label: "Coincidencia", value: "Página exacta", accent: true },
        { label: "Análisis", value: "Falta la meta descripción" },
      ],
    },
    decide: {
      title: "Decidir",
      body: "Foundfy convierte esa evidencia en una única decisión prioritaria.",
      panelLabel: "Ejemplo de decisión priorizada",
      chip: "Primero esto",
      why: "¿Por qué esto?",
      panelTitle: "Añadir una meta descripción en /guias/primeros-pasos",
      fields: [
        {
          label: "Por qué importa",
          value: "Esta página ya aparece en Google y no tiene meta descripción.",
        },
        {
          label: "Evidencia de la web",
          value: "Falta la meta descripción en una página analizada.",
        },
        {
          label: "Objetivo",
          value: "Priorizar las páginas que ya aparecen antes de proponer contenido nuevo.",
        },
        {
          label: "Periodo",
          value: "Últimos 28 días · 1.240 impresiones · 86 clics",
        },
      ],
    },
    act: {
      title: "Publicar y verificar",
      body: "Te ayudamos a llevar el cambio aprobado de la propuesta a tu web. Después, Foundfy revisa la página y comprueba que está publicado.",
      panelLabel: "Ejemplo de un cambio, de la propuesta a la verificación",
      lifecycle: ["Preparado", "Aprobado", "Publicado", "Verificado"],
      previewLabel: "Cambio exacto · Actualizar la meta descripción",
      previewPage: "/guias/primeros-pasos",
      current: { label: "Actual", value: "Ninguna" },
      proposed: {
        label: "Propuesta",
        value: "Una guía práctica para la búsqueda que ya lleva a esta página.",
      },
      verification: {
        label: "Verificación",
        value:
          "Verificado. Foundfy ha vuelto a revisar la página y la meta descripción coincide con el cambio aprobado.",
      },
    },
  },
  capabilityGrid: {
    sectionId: "capacidades",
    eyebrow: "Capacidades",
    heading: "Lo que necesitas para saber qué mejorar.",
    supporting:
      "Las mismas señales que Foundfy ya usa: datos de búsqueda, evidencia de tu web, una decisión y la comprobación de que el cambio está publicado.",
    exampleNote: "Datos de ejemplo, con fines ilustrativos.",
    visibility: {
      kicker: "Visibilidad en búsqueda",
      title: "Búsquedas, páginas, clics e impresiones.",
      head: ["Google Search", "Últimos 28 días"],
      pages: [
        { path: "/guias/primeros-pasos", detail: "1.240 impresiones · 86 clics" },
        { path: "/precios", detail: "640 impresiones · 41 clics" },
        { path: "/", detail: "210 impresiones · 28 clics" },
      ],
    },
    content: {
      kicker: "Oportunidades de contenido",
      title: "Basadas en lo que la gente busca de verdad y para qué.",
      query: "guía para empezar",
      leadingPage: { label: "Página que lidera", value: "/guias/primeros-pasos" },
      demand: { label: "Demanda", value: "1.240 impresiones · 86 clics" },
      note: "Revisar esta oportunidad",
    },
    technical: {
      kicker: "Acciones técnicas",
      title: "Canonicals, metadatos, indexabilidad, enlaces internos y errores de rastreo.",
      items: [
        { label: "Canonical", value: "/guia apunta a otra página" },
        { label: "Metadatos", value: "Falta la meta descripción" },
        { label: "Indexabilidad", value: "La página no bloquea la indexación" },
        { label: "Enlaces internos", value: "Pocos enlaces llegan a esta página" },
      ],
    },
    ai: {
      kicker: "Búsqueda con IA",
      title: "Visibilidad más allá de la búsqueda tradicional.",
      ahead: "En camino",
      text: "Estamos trabajando en cómo aparece esta web cuando alguien pregunta a un asistente de IA.",
    },
    execution: {
      kicker: "Implementación",
      title: "Preparar, revisar, aprobar y publicar, con nuestra ayuda.",
      actions: ["Preparar este cambio", "Aprobar", "Publicar este cambio"],
    },
    verification: {
      kicker: "Verificación",
      title: "Volvemos a analizar tu web y confirmamos que el cambio está publicado.",
      expected: { label: "Esperado", value: "Meta descripción aprobada" },
      observed: { label: "Observado", value: "La misma descripción en el nuevo análisis" },
      match: "Verificado · la página coincide",
    },
  },
  earlyAccess: {
    eyebrow: "Solicita una revisión",
    text: {
      heading: "Cuéntanos sobre tu negocio.",
      body: "Trabajamos de cerca con un pequeño grupo de negocios. El análisis inicial es gratuito; si quieres ayuda para aplicar las mejoras, te explicamos el servicio y sus condiciones antes de empezar.",
      personalizedHeading: "Trabajemos en {host}.",
      personalizedBody:
        "Responde unas preguntas rápidas y te escribiremos por email con los siguientes pasos y las condiciones del servicio.",
      successHeadline: "¡SOLICITUD RECIBIDA!",
      successSubline: "Te escribiremos por email.",
      personalizedSuccessSubline: "Te escribiremos sobre {host}.",
    },
    helloPrefix: "O escríbenos directamente a",
    selectPlaceholder: "Elige una opción",
    questions: {
      role: "¿Qué te describe mejor?",
      interest: "¿Qué te interesa más?",
      website: "Tu web (opcional)",
      websiteSummary: "Web",
      email: "¿A qué email te escribimos?",
    },
    roles: {
      "business-owner": "Negocio / Marca",
      "seo-professional": "Profesional SEO",
      agency: "Agencia",
      other: "Otro",
    },
    interests: {
      seo: "Diagnóstico SEO",
      ai: "Visibilidad en IA",
      content: "Oportunidades de contenido",
      technical: "Revisión técnica",
      all: "Todo lo anterior",
    },
    websitePlaceholder: "https://",
    websiteLabel: "Tu web (opcional)",
    emailPlaceholder: "tu@empresa.com",
    emailLabel: "Tu email",
    next: "Siguiente",
    continueLabel: "Continuar",
    skipLabel: "Omitir y continuar",
    back: "Atrás",
    backLabel: "Volver a la pregunta anterior",
    submit: "Solicitar revisión",
    submitting: "Enviando…",
    errors: {
      websiteInvalid: "Introduce una web válida o déjalo en blanco.",
      emailInvalid: "Introduce un email válido.",
      generic: "Algo ha fallado. Inténtalo de nuevo.",
      server: "Revisa tus respuestas e inténtalo de nuevo.",
    },
  },
  closing: {
    headline: ["Que te encuentren hoy.", "Y también", "mañana."],
    footerText: "Que te encuentren, busquen donde busquen.",
  },
  footer: {
    privacy: { href: "/es/privacidad", label: "Privacidad" },
  },
} as const satisfies LandingCopy;
