import { PRIVACY_SECTIONS } from "./content";

// Spanish translation of the privacy page. It must say the same as the English
// version (content.ts): change both together, never one alone.

export const PRIVACY_PAGE_TITLE_ES = "Privacidad";

export const PRIVACY_INTRO_ES =
  "Foundfy está en beta privada. Esta página describe qué ocurre cuando usas el producto actual.";

export const PRIVACY_SECTIONS_ES = [
  {
    title: "Análisis de webs",
    body: "Cuando envías una URL, Foundfy procesa esa dirección y obtiene de ella contenido público de las páginas, como el HTML que cualquier visitante podría abrir en un navegador. No es una auditoría completa del sitio: cada análisis cubre un número limitado de páginas. Foundfy no mide tus posiciones ni tu visibilidad en Google, ChatGPT, Gemini, Perplexity ni otros buscadores.",
  },
  {
    title: "Cuenta de Google",
    body: "Si eliges conectar Google (Connect Google), Foundfy pide a Google acceso de solo lectura a Search Console y guarda el identificador y el email de tu cuenta de Google para recordar esa conexión. Foundfy también guarda en el servidor un token de actualización cifrado para mantener esa conexión. Después puedes confirmar qué propiedad de Search Console corresponde a esta web. Si eliges configurar Search Console, Foundfy pide un permiso adicional para añadir una propiedad de Search Console para tu web y solicitar la verificación de propiedad de Google. Foundfy no modifica tu DNS: el registro de verificación lo añades tú. Los datos de rendimiento de búsqueda de Search Console se usan para ofrecer las funciones de Foundfy. Cuando sincronizas los datos de búsqueda de Google, Foundfy puede guardar evidencia privada del rendimiento de búsqueda de esa propiedad, como impresiones, clics, CTR, posición media, páginas y búsquedas que Google haya registrado. Foundfy también puede derivar de esa evidencia privada de Google Search las siguientes acciones priorizadas. El propietario conectado también puede pedir a Foundfy que incluya una página visible en Google en un análisis posterior de la web. Esta evidencia, esas acciones derivadas y esas solicitudes de análisis de páginas solo son visibles para el propietario conectado. Una cookie de sesión privada recuerda que eres la cuenta de Google que conectó esta web. Conocer el enlace de una web no basta para ver la información de esa cuenta de Google. Puedes desconectarla: al hacerlo, Foundfy revoca su acceso a Google cuando es posible, elimina la evidencia de rendimiento de Search Console guardada, elimina las acciones derivadas que usaban esa evidencia, elimina las comparaciones de Google Search guardadas tras un cambio verificado, detiene las solicitudes de análisis de páginas pendientes que dependían de Search Console y elimina el token guardado. Foundfy conserva los datos de los análisis y de comprensión de la web, y conserva el registro de que un cambio aprobado se ejecutó o se verificó, sin retener cifras de rendimiento de Google.",
  },
  {
    title: "Qué guardamos",
    body: "Los datos de los análisis y sus resultados se guardan para que puedas volver a consultar el historial. Si nos envías el formulario de solicitud, Foundfy guarda tu email y los campos que envías: rol, interés y, opcionalmente, una web.",
  },
  {
    title: "Explicación ampliada",
    body: "Si usas la opción de explicación ampliada (Explain further), puede enviarse a OpenAI evidencia limitada del hallazgo para generar esa explicación.",
  },
  {
    title: "Preguntas y eliminación de datos",
    body: "Para hacer una pregunta o pedir que eliminemos tus datos, escribe a hello@foundfy.me.",
  },
] as const satisfies ReadonlyArray<{ title: string; body: string }> & {
  length: (typeof PRIVACY_SECTIONS)["length"];
};
