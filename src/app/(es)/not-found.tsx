import NotFoundView from "@/components/NotFoundView";
import { ES_LANDING_COPY } from "@/lib/i18n/landing/es";

// Spanish 404 for /es/* (see es/[...missing]). It must live next to
// (es)/layout.tsx: a not-found.tsx inside es/ is not used.
// Next 15 delivers notFound() as an HTTP error fallback: the status is a
// reliable 404 with noindex, and the browser renders this page (lang="es",
// Spanish title) from the streamed payload once it loads.
export default function SpanishNotFound() {
  return <NotFoundView copy={ES_LANDING_COPY} />;
}
