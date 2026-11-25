// Spanish "Cómo funciona" page (Spanish Experience PR 3), approved by the
// product owner. Rules: tuteo; describe today's assisted service precisely
// (Foundfy analyses and proposes, the owner approves, publication is assisted,
// Foundfy checks what was implemented); separate implementation checks from
// SEO results; no price figure; no AI search visibility claims.
export const HOW_IT_WORKS_ES = {
  path: "/es/como-funciona",
  meta: {
    title: "Cómo funciona | Foundfy",
    description:
      "Qué hace Foundfy, qué decides tú y cómo comprobamos que cada cambio está publicado en tu web.",
  },
  heading: "Cómo funciona Foundfy",
  intro:
    "Foundfy es un servicio de SEO para pequeñas empresas que no tienen tiempo ni equipo para ocuparse del posicionamiento. Analizamos tu web y, si conectas Google Search Console, sus datos de búsqueda para identificar oportunidades y explicarte qué conviene mejorar. Tú decides qué cambios se aprueban. Si quieres ayuda para aplicarlos, coordinamos contigo la publicación y comprobamos qué se ha implementado.",
  service: {
    title: "Un servicio, no otra herramienta que aprender",
    body: "No tienes que aprender SEO ni saber qué mirar. Nuestro software analiza tu web y ordena lo que hay que hacer; nosotros te explicamos cada propuesta y te acompañamos hasta que el cambio está publicado.",
  },
  steps: {
    title: "Paso a paso",
    items: [
      {
        title: "Analizamos tu web",
        body: "Revisamos tus páginas públicas, como lo haría cualquier visitante, y buscamos lo que puede impedir que te encuentren: páginas sin título o con títulos repetidos, descripciones que faltan, enlaces que no funcionan, redirecciones o configuraciones que pueden dificultar que Google rastree o indexe tus páginas. El análisis inicial cubre hasta 10 páginas; no es una auditoría completa.",
      },
      {
        title: "Conectas Google Search Console, si quieres",
        body: "Con tu permiso, vemos qué búsquedas ya muestran tu web en Google y con cuántas impresiones y clics. Para consultar esos datos, el acceso es de solo lectura y puedes desconectarlo cuando quieras. Si todavía no tienes Search Console, podemos ayudarte a configurarlo. En ese caso, Google te pedirá un permiso adicional para añadir tu web a Search Console y solicitar su verificación.",
      },
      {
        title: "Decidimos qué hacer primero",
        body: "Cruzamos lo que vemos en tu web con tus datos de búsqueda y con lo que quieres conseguir, y elegimos una prioridad. Te enseñamos el porqué: qué hemos encontrado en la página y qué búsquedas la muestran ya en Google. Sin Search Console también podemos detectar problemas en las páginas analizadas, aunque no podemos priorizarlos con las mismas señales de búsqueda.",
      },
      {
        title: "Tú apruebas y te ayudamos a publicarlo",
        body: "Te enseñamos qué cambiaríamos y cómo quedaría. Nada se modifica sin tu aprobación. Si decides aplicar la mejora con nuestra ayuda, acordamos cómo hacerlo: puedes publicar el cambio siguiendo nuestras indicaciones o coordinar su implementación con nosotros. Foundfy no modifica tu web por su cuenta.",
      },
      {
        title: "Comprobamos que está publicado",
        body: "Cuando el cambio ya está en tu web, volvemos a analizar la página y la comparamos con lo que aprobaste. Si coincide, lo marcamos como verificado. Si no hemos podido comprobarlo, te lo decimos: nunca lo damos por hecho. Después usamos la nueva información para proponerte el siguiente paso.",
      },
    ],
  },
  responsibilities: {
    title: "Qué hace Foundfy y qué decides tú",
    items: [
      {
        who: "Foundfy",
        what: "analiza tu web, ordena las prioridades, explica cada hallazgo y prepara la propuesta de cambio.",
      },
      {
        who: "Tú",
        what: "decides si conectas Google, qué cambios se aprueban y cuándo se publican.",
      },
      { who: "Tú, con nuestra ayuda", what: "publicas el cambio en tu web." },
      {
        who: "Foundfy, después",
        what: "comprueba que el cambio aprobado está publicado.",
      },
    ],
  },
  ai: {
    title: "Cómo usamos la IA",
    paragraphs: [
      "Usamos IA para explicar de forma sencilla los hallazgos y preparar una primera interpretación de tu web: a qué se dedica tu negocio y qué páginas son importantes. Esa interpretación se confirma antes de utilizarla para priorizar.",
      "Las recomendaciones se fundamentan en la evidencia de tu web, los datos de Google cuando están disponibles y el contexto que confirmas sobre tu negocio. La IA no publica cambios ni sustituye tu aprobación.",
    ],
  },
  expectations: {
    title: "Lo que no prometemos",
    paragraphs: [
      "Comprobamos los cambios. No prometemos resultados que no podemos garantizar.",
      "No garantizamos una posición concreta en Google ni un número de clientes. Que una mejora esté publicada y verificada no significa que haya producido resultados de inmediato. Distinguimos entre lo que hemos comprobado y lo que todavía necesita tiempo y datos para evaluarse.",
    ],
  },
  free: {
    title: "Qué es gratis",
    body: "El análisis inicial es gratuito: hasta 10 páginas y sin tarjeta de crédito. Si quieres ayuda para aplicar las mejoras, te explicamos el servicio y sus condiciones antes de empezar.",
  },
  cta: {
    title: "¿Quieres que revisemos tu web?",
    label: "Solicitar una revisión",
    href: "/es#early-access",
  },
} as const;
