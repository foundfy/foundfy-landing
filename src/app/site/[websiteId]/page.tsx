import SitePageView from "@/components/site/SitePageView";
import shellStyles from "@/components/persistent/PersistentPageShell.module.css";
import { isValidUuid } from "@/lib/websites/uuid";

type SitePageProps = {
  params: Promise<{ websiteId: string }>;
};

export default async function SitePage({ params }: SitePageProps) {
  const { websiteId } = await params;

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
        <SitePageView websiteId={websiteId} />
      </div>
    </main>
  );
}
