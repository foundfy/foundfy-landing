"use client";

import { useCallback, useEffect, useState } from "react";
import type { ObserveNotice } from "@/lib/gsc/config";
import {
  OBSERVE_APPEARANCES_LABEL,
  OBSERVE_CHANGE_PROPERTY_LABEL,
  OBSERVE_CONNECT_LABEL,
  OBSERVE_CONNECTED_TITLE,
  OBSERVE_DISCONNECT_LABEL,
  OBSERVE_EVIDENCE_DETAIL_LABEL,
  OBSERVE_EVIDENCE_EMPTY_COPY,
  OBSERVE_EVIDENCE_HIDE_LABEL,
  OBSERVE_EVIDENCE_LAG_COPY,
  OBSERVE_EVIDENCE_PERIOD_LABEL,
  OBSERVE_EVIDENCE_SYNC_ERROR,
  OBSERVE_EVIDENCE_TITLE,
  OBSERVE_EXPIRED_COPY,
  OBSERVE_FOUND_PROPERTY_TITLE,
  OBSERVE_LAST_SYNCED_LABEL,
  OBSERVE_LIKELY_HEADING,
  OBSERVE_LOADING_PROPERTIES,
  OBSERVE_NO_PROPERTY_COPY,
  OBSERVE_NOTICE_COPY,
  OBSERVE_OTHER_HEADING,
  OBSERVE_PAGES_HEADING,
  OBSERVE_PAGES_SEEN_LABEL,
  OBSERVE_QUERIES_HEADING,
  OBSERVE_QUERIES_REPORTED_LABEL,
  OBSERVE_SEARCH_CONSOLE_CONNECTED_NEXT,
  OBSERVE_SEARCH_CONSOLE_CONNECTED_TITLE,
  OBSERVE_SECTION_HEADING,
  OBSERVE_SYNC_LABEL,
  OBSERVE_USE_PROPERTY_LABEL,
  OBSERVE_VISITS_LABEL,
} from "@/lib/gsc/display";
import type {
  ObserveOwnerView,
  ObservePropertyList,
  RankedGscProperty,
  SearchAnalyticsView,
} from "@/lib/gsc/types";
import { formatEvidenceDate } from "@/lib/gsc/window";
import styles from "./SitePageView.module.css";

type SiteObserveSectionProps = {
  websiteId: string;
  notice: ObserveNotice | null;
  onUpdated?: () => void;
};

type ObserveLoadState =
  | { phase: "loading" }
  | { phase: "disconnected" }
  | {
      phase: "google_connected";
      view: ObserveOwnerView;
      properties: ObservePropertyList | null;
      selectedSiteUrl: string | null;
    }
  | { phase: "search_console_connected"; view: ObserveOwnerView; changing: boolean }
  | { phase: "error"; message: string };

export default function SiteObserveSection({
  websiteId,
  notice,
  onUpdated,
}: SiteObserveSectionProps) {
  const [state, setState] = useState<ObserveLoadState>({ phase: "loading" });
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isBinding, setIsBinding] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [evidence, setEvidence] = useState<SearchAnalyticsView | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/websites/${websiteId}/observe`, {
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        setState({ phase: "disconnected" });
        return;
      }

      const payload = (await response.json()) as ObserveOwnerView & { error?: string };

      if (!response.ok) {
        setState({
          phase: "error",
          message: payload.error ?? "Unable to load Google connection state.",
        });
        return;
      }

      if (payload.status === "search_console_connected" && payload.property) {
        setState({ phase: "search_console_connected", view: payload, changing: false });
        setEvidence(null);
        return;
      }

      if (payload.status !== "google_connected") {
        setState({ phase: "disconnected" });
        return;
      }

      setState({
        phase: "google_connected",
        view: payload,
        properties: null,
        selectedSiteUrl: null,
      });
    } catch {
      setState({
        phase: "error",
        message: "Unable to load Google connection state.",
      });
    }
  }, [websiteId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (state.phase !== "google_connected" || state.properties) {
      return;
    }

    let cancelled = false;

    async function loadProperties() {
      try {
        const response = await fetch(`/api/websites/${websiteId}/observe/properties`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as ObservePropertyList & {
          error?: string;
        };

        if (cancelled) {
          return;
        }

        if (response.status === 401 && payload.error === OBSERVE_EXPIRED_COPY) {
          setState({ phase: "disconnected" });
          setActionError(OBSERVE_EXPIRED_COPY);
          return;
        }

        if (response.status === 401 || response.status === 403) {
          setState({ phase: "disconnected" });
          return;
        }

        if (!response.ok) {
          setActionError(payload.error ?? "Unable to list Search Console properties.");
          return;
        }

        setState((current) =>
          current.phase === "google_connected"
            ? {
                ...current,
                properties: payload,
                selectedSiteUrl: payload.recommendedSiteUrl,
              }
            : current,
        );
      } catch {
        if (!cancelled) {
          setActionError("Unable to list Search Console properties.");
        }
      }
    }

    void loadProperties();
    return () => {
      cancelled = true;
    };
  }, [state, websiteId]);

  useEffect(() => {
    if (state.phase !== "search_console_connected" || state.changing || evidence) {
      return;
    }

    let cancelled = false;

    async function loadEvidence() {
      try {
        const response = await fetch(`/api/websites/${websiteId}/observe/search-analytics`, {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as SearchAnalyticsView & {
          error?: string;
        };

        if (cancelled) {
          return;
        }

        if (response.status === 401 && payload.error === OBSERVE_EXPIRED_COPY) {
          setState({ phase: "disconnected" });
          setActionError(OBSERVE_EXPIRED_COPY);
          return;
        }

        if (response.status === 401 || response.status === 403) {
          setState({ phase: "disconnected" });
          return;
        }

        if (!response.ok) {
          setActionError(payload.error ?? OBSERVE_EVIDENCE_SYNC_ERROR);
          return;
        }

        setEvidence(payload);
      } catch {
        if (!cancelled) {
          setActionError(OBSERVE_EVIDENCE_SYNC_ERROR);
        }
      }
    }

    void loadEvidence();
    return () => {
      cancelled = true;
    };
  }, [state, websiteId, evidence]);

  const disconnect = async () => {
    setIsDisconnecting(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/websites/${websiteId}/observe/disconnect`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setActionError(payload.error ?? "Unable to disconnect.");
        return;
      }

      setState({ phase: "disconnected" });
      setEvidence(null);
      setDetailsOpen(false);
      onUpdated?.();
    } catch {
      setActionError("Unable to disconnect.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const bind = async (siteUrl: string | null) => {
    if (!siteUrl) {
      return;
    }

    setIsBinding(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/websites/${websiteId}/observe/property`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl }),
      });
      const payload = (await response.json().catch(() => ({}))) as ObserveOwnerView & {
        error?: string;
      };

      if (!response.ok) {
        setActionError(payload.error ?? "Unable to save the Search Console property.");
        return;
      }

      setState({
        phase: "search_console_connected",
        view: {
          status: "search_console_connected",
          email: state.phase === "google_connected" ? state.view.email : payload.email ?? null,
          propertySelected: true,
          property: payload.property ?? {
            siteUrl,
            propertyType: siteUrl.startsWith("sc-domain:") ? "domain" : "url_prefix",
            permissionLevel: null,
          },
        },
        changing: false,
      });
      setEvidence(null);
      setDetailsOpen(false);
      onUpdated?.();
    } catch {
      setActionError("Unable to save the Search Console property.");
    } finally {
      setIsBinding(false);
    }
  };

  const startChangeProperty = () => {
    if (state.phase !== "search_console_connected") {
      return;
    }
    setActionError(null);
    setEvidence(null);
    setDetailsOpen(false);
    setState({
      phase: "google_connected",
      view: {
        ...state.view,
        status: "google_connected",
        propertySelected: false,
      },
      properties: null,
      selectedSiteUrl: state.view.property?.siteUrl ?? null,
    });
    onUpdated?.();
  };

  const syncEvidence = async () => {
    setIsSyncing(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/websites/${websiteId}/observe/search-analytics/sync`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as SearchAnalyticsView & {
        error?: string;
      };

      if (response.status === 401 && payload.error === OBSERVE_EXPIRED_COPY) {
        setState({ phase: "disconnected" });
        setActionError(OBSERVE_EXPIRED_COPY);
        return;
      }

      if (!response.ok) {
        setActionError(payload.error ?? OBSERVE_EVIDENCE_SYNC_ERROR);
        return;
      }

      setEvidence(payload);
      onUpdated?.();
    } catch {
      setActionError(OBSERVE_EVIDENCE_SYNC_ERROR);
    } finally {
      setIsSyncing(false);
    }
  };

  const noticeCopy = notice ? OBSERVE_NOTICE_COPY[notice] : null;

  return (
    <section className={styles.section} aria-labelledby="site-observe">
      <div className={styles.sectionIntro}>
        <h2 id="site-observe" className={styles.sectionHeading}>
          {OBSERVE_SECTION_HEADING}
        </h2>
      </div>

      {state.phase === "loading" ? (
        <p className={styles.emptyStateCopy}>Checking Google connection…</p>
      ) : null}

      {state.phase === "disconnected" ? (
        <div className={styles.emptyStateBlock}>
          <p className={styles.emptyStateCopy}>
            Connect Google to begin observing how people discover this site.
          </p>
          <a
            className={styles.observeConnectButton}
            href={`/api/websites/${websiteId}/observe/connect`}
          >
            {OBSERVE_CONNECT_LABEL}
          </a>
        </div>
      ) : null}

      {state.phase === "google_connected" ? (
        <GoogleConnectedPanel
          email={state.view.email}
          properties={state.properties}
          selectedSiteUrl={state.selectedSiteUrl}
          isBinding={isBinding}
          isDisconnecting={isDisconnecting}
          onSelect={(siteUrl) =>
            setState((current) =>
              current.phase === "google_connected"
                ? { ...current, selectedSiteUrl: siteUrl }
                : current,
            )
          }
          onBind={() => void bind(state.selectedSiteUrl)}
          onDisconnect={() => void disconnect()}
        />
      ) : null}

      {state.phase === "search_console_connected" && state.view.property ? (
        <SearchConsoleConnectedPanel
          siteUrl={state.view.property.siteUrl}
          evidence={evidence}
          detailsOpen={detailsOpen}
          isSyncing={isSyncing}
          isDisconnecting={isDisconnecting}
          isBinding={isBinding}
          onSync={() => void syncEvidence()}
          onToggleDetails={() => setDetailsOpen((open) => !open)}
          onChangeProperty={startChangeProperty}
          onDisconnect={() => void disconnect()}
        />
      ) : null}

      {state.phase === "error" ? (
        <p className={styles.interpretationError} role="alert">
          {state.message}
        </p>
      ) : null}

      {noticeCopy && notice && notice !== "connected" ? (
        <p
          className={
            notice === "disconnected" ? styles.sectionMeta : styles.interpretationError
          }
          role="status"
        >
          {noticeCopy}
        </p>
      ) : null}

      {actionError ? (
        <p className={styles.interpretationError} role="alert">
          {actionError}
        </p>
      ) : null}
    </section>
  );
}

function GoogleConnectedPanel({
  email,
  properties,
  selectedSiteUrl,
  isBinding,
  isDisconnecting,
  onSelect,
  onBind,
  onDisconnect,
}: {
  email: string | null;
  properties: ObservePropertyList | null;
  selectedSiteUrl: string | null;
  isBinding: boolean;
  isDisconnecting: boolean;
  onSelect: (siteUrl: string) => void;
  onBind: () => void;
  onDisconnect: () => void;
}) {
  const recommended = properties?.likely[0] ?? null;
  const singleLikelyOnly =
    Boolean(properties) &&
    properties!.likely.length === 1 &&
    properties!.other.length === 0;
  const hasSelectableList =
    Boolean(properties) &&
    (properties!.likely.length > 1 || properties!.other.length > 0);

  return (
    <div className={styles.emptyStateBlock}>
      <p className={styles.emptyStateTitle}>{OBSERVE_CONNECTED_TITLE}</p>
      {email ? <p className={styles.sectionMeta}>{email}</p> : null}

      {!properties ? (
        <p className={styles.emptyStateCopy}>{OBSERVE_LOADING_PROPERTIES}</p>
      ) : null}

      {properties && properties.likely.length === 0 && properties.other.length === 0 ? (
        <p className={styles.emptyStateCopy}>{OBSERVE_NO_PROPERTY_COPY}</p>
      ) : null}

      {singleLikelyOnly && recommended ? (
        <>
          <p className={styles.emptyStateCopy}>{OBSERVE_FOUND_PROPERTY_TITLE}</p>
          <p className={styles.observePropertyId}>{recommended.siteUrl}</p>
          <button
            type="button"
            className={styles.observeConnectButton}
            onClick={onBind}
            disabled={isBinding}
          >
            {isBinding ? "Saving…" : OBSERVE_USE_PROPERTY_LABEL}
          </button>
        </>
      ) : null}

      {hasSelectableList && (properties?.likely.length ?? 0) > 0 ? (
        <PropertyGroup
          heading={OBSERVE_LIKELY_HEADING}
          properties={properties?.likely ?? []}
          selectedSiteUrl={selectedSiteUrl}
          onSelect={onSelect}
        />
      ) : null}

      {properties && properties.other.length > 0 ? (
        <PropertyGroup
          heading={OBSERVE_OTHER_HEADING}
          properties={properties.other}
          selectedSiteUrl={selectedSiteUrl}
          onSelect={onSelect}
        />
      ) : null}

      {hasSelectableList ? (
        <button
          type="button"
          className={styles.observeConnectButton}
          onClick={onBind}
          disabled={isBinding || !selectedSiteUrl}
        >
          {isBinding ? "Saving…" : OBSERVE_USE_PROPERTY_LABEL}
        </button>
      ) : null}

      <button
        type="button"
        className={styles.textButton}
        onClick={onDisconnect}
        disabled={isDisconnecting}
      >
        {isDisconnecting ? "Disconnecting…" : OBSERVE_DISCONNECT_LABEL}
      </button>
    </div>
  );
}

function PropertyGroup({
  heading,
  properties,
  selectedSiteUrl,
  onSelect,
}: {
  heading: string;
  properties: RankedGscProperty[];
  selectedSiteUrl: string | null;
  onSelect: (siteUrl: string) => void;
}) {
  return (
    <>
      <p className={styles.observePropertyGroupHeading}>{heading}</p>
      <ul className={styles.observePropertyList}>
        {properties.map((property) => (
          <li key={property.siteUrl} className={styles.observePropertyItem}>
            <button
              type="button"
              className={styles.observePropertyChoice}
              aria-pressed={selectedSiteUrl === property.siteUrl}
              onClick={() => onSelect(property.siteUrl)}
            >
              <span className={styles.observePropertyId}>{property.siteUrl}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function formatPercent(ctr: number): string {
  return `${(ctr * 100).toFixed(1)}%`;
}

function formatPosition(position: number): string {
  return position.toFixed(1);
}

function formatSyncedAt(syncedAt: string | null): string | null {
  if (!syncedAt) {
    return null;
  }

  return formatEvidenceDate(syncedAt.slice(0, 10));
}

function SearchConsoleConnectedPanel({
  siteUrl,
  evidence,
  detailsOpen,
  isSyncing,
  isDisconnecting,
  isBinding,
  onSync,
  onToggleDetails,
  onChangeProperty,
  onDisconnect,
}: {
  siteUrl: string;
  evidence: SearchAnalyticsView | null;
  detailsOpen: boolean;
  isSyncing: boolean;
  isDisconnecting: boolean;
  isBinding: boolean;
  onSync: () => void;
  onToggleDetails: () => void;
  onChangeProperty: () => void;
  onDisconnect: () => void;
}) {
  const synced = evidence?.status === "completed";
  const syncedAtLabel = formatSyncedAt(evidence?.syncedAt ?? null);

  return (
    <div className={styles.emptyStateBlock}>
      <p className={styles.emptyStateTitle}>
        {synced ? OBSERVE_EVIDENCE_TITLE : OBSERVE_SEARCH_CONSOLE_CONNECTED_TITLE}
      </p>
      <p className={styles.observePropertyId}>{siteUrl}</p>

      {!synced ? (
        <p className={styles.emptyStateCopy}>{OBSERVE_SEARCH_CONSOLE_CONNECTED_NEXT}</p>
      ) : (
        <p className={styles.emptyStateCopy}>{OBSERVE_EVIDENCE_PERIOD_LABEL}</p>
      )}

      {synced && evidence?.empty ? (
        <p className={styles.emptyStateCopy}>{OBSERVE_EVIDENCE_EMPTY_COPY}</p>
      ) : null}

      {synced && evidence && !evidence.empty ? (
        <dl className={styles.observeEvidenceStats}>
          <div>
            <dt>{OBSERVE_APPEARANCES_LABEL}</dt>
            <dd>{formatCount(evidence.summary.impressions)}</dd>
          </div>
          <div>
            <dt>{OBSERVE_VISITS_LABEL}</dt>
            <dd>{formatCount(evidence.summary.clicks)}</dd>
          </div>
          <div>
            <dt>{OBSERVE_PAGES_SEEN_LABEL}</dt>
            <dd>{formatCount(evidence.summary.pagesSeen)}</dd>
          </div>
          <div>
            <dt>{OBSERVE_QUERIES_REPORTED_LABEL}</dt>
            <dd>{formatCount(evidence.summary.queriesReported)}</dd>
          </div>
        </dl>
      ) : null}

      {synced && syncedAtLabel ? (
        <p className={styles.sectionMeta}>
          {OBSERVE_LAST_SYNCED_LABEL}: {syncedAtLabel}
        </p>
      ) : null}

      {synced ? <p className={styles.sectionMeta}>{OBSERVE_EVIDENCE_LAG_COPY}</p> : null}

      {synced && evidence && (evidence.truncated.pages || evidence.truncated.queries) ? (
        <p className={styles.sectionMeta}>This import reached Foundfy’s current row cap.</p>
      ) : null}

      <button
        type="button"
        className={styles.observeConnectButton}
        onClick={onSync}
        disabled={isSyncing || isDisconnecting}
      >
        {isSyncing ? "Syncing…" : OBSERVE_SYNC_LABEL}
      </button>

      {synced && evidence && !evidence.empty ? (
        <button type="button" className={styles.textButton} onClick={onToggleDetails}>
          {detailsOpen ? OBSERVE_EVIDENCE_HIDE_LABEL : OBSERVE_EVIDENCE_DETAIL_LABEL}
        </button>
      ) : null}

      {detailsOpen && evidence && !evidence.empty ? (
        <div className={styles.observeEvidenceDetail}>
          <p className={styles.emptyStateCopy}>
            CTR {formatPercent(evidence.summary.ctr)} · Average position{" "}
            {formatPosition(evidence.summary.position)}
          </p>
          {evidence.pages.length > 0 ? (
            <>
              <p className={styles.observePropertyGroupHeading}>{OBSERVE_PAGES_HEADING}</p>
              <ul className={styles.observeEvidenceList}>
                {evidence.pages.slice(0, 10).map((page) => (
                  <li key={page.pageUrl}>
                    <span className={styles.observePropertyId}>{page.pageUrl}</span>
                    <span className={styles.sectionMeta}>
                      {formatCount(page.impressions)} appearances · {formatCount(page.clicks)}{" "}
                      visits · CTR {formatPercent(page.ctr)} · position{" "}
                      {formatPosition(page.position)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {evidence.queries.length > 0 ? (
            <>
              <p className={styles.observePropertyGroupHeading}>{OBSERVE_QUERIES_HEADING}</p>
              <ul className={styles.observeEvidenceList}>
                {evidence.queries.slice(0, 10).map((row) => (
                  <li key={row.query}>
                    <span>{row.query}</span>
                    <span className={styles.sectionMeta}>
                      {formatCount(row.impressions)} appearances · {formatCount(row.clicks)} visits
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        className={styles.textButton}
        onClick={onChangeProperty}
        disabled={isDisconnecting || isBinding || isSyncing}
      >
        {OBSERVE_CHANGE_PROPERTY_LABEL}
      </button>
      <button
        type="button"
        className={styles.textButton}
        onClick={onDisconnect}
        disabled={isDisconnecting}
      >
        {isDisconnecting ? "Disconnecting…" : OBSERVE_DISCONNECT_LABEL}
      </button>
    </div>
  );
}
