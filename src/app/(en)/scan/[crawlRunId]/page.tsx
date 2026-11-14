import ScanPageView from "@/components/scan/ScanPageView";
import shellStyles from "@/components/persistent/PersistentPageShell.module.css";
import { isValidUuid } from "@/lib/websites/uuid";

type ScanPageProps = {
  params: Promise<{ crawlRunId: string }>;
};

export default async function ScanPage({ params }: ScanPageProps) {
  const { crawlRunId } = await params;

  if (!isValidUuid(crawlRunId)) {
    return (
      <main className={shellStyles.page}>
        <div className={shellStyles.inner}>
          <p className={shellStyles.errorMessage} role="alert">
            Invalid scan id.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={shellStyles.page}>
      <div className={shellStyles.inner}>
        <div className={shellStyles.analysisSurface}>
          <ScanPageView crawlRunId={crawlRunId} />
        </div>
      </div>
    </main>
  );
}
