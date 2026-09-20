import SitePageView from "@/components/site/SitePageView";
import shellStyles from "@/components/persistent/PersistentPageShell.module.css";
import { OBSERVE_NOTICE_VALUES, type ObserveNotice } from "@/lib/gsc/config";
import { isValidUuid } from "@/lib/websites/uuid";

type SitePageProps = {
  params: Promise<{ websiteId: string }>;
  searchParams: Promise<{ observe?: string | string[] }>;
};

function parseObserveNotice(value: string | string[] | undefined): ObserveNotice | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) {
    return null;
  }

  return OBSERVE_NOTICE_VALUES.includes(raw as ObserveNotice)
    ? (raw as ObserveNotice)
    : null;
}

export default async function SitePage({ params, searchParams }: SitePageProps) {
  const { websiteId } = await params;
  const query = await searchParams;
  const observeNotice = parseObserveNotice(query.observe);

  if (!isValidUuid(websiteId)) {
    return (
      <main className={shellStyles.page}>
        <div className={shellStyles.inner}>
          <p className={shellStyles.errorMessage} role="alert">
            Invalid website id.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={shellStyles.page}>
      <div className={`${shellStyles.inner} ${shellStyles.siteInner}`}>
        <SitePageView websiteId={websiteId} observeNotice={observeNotice} />
      </div>
    </main>
  );
}
