export type OpportunityQueryInput = {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
};

export type OpportunityQueryPageInput = {
  query: string;
  pageUrl: string;
  pageId: string | null;
  impressions: number;
};

export type QueryOpportunityCard = {
  id: string;
  query: string;
  groupingKey: string;
  appearances: number;
  visits: number;
  position: number;
  leadingPageUrl: string;
  leadingPageId: string | null;
  mapped: boolean;
  variants: string[];
};

export type QueryOpportunitiesView = {
  status: "not_synced" | "completed";
  empty: boolean;
  emptyReason: "not_synced" | "no_queries" | "no_eligible" | null;
  periodStart: string;
  periodEnd: string;
  windowDays: number;
  syncedAt: string | null;
  truncated: {
    queries: boolean;
    queryPages: boolean;
  };
  opportunities: QueryOpportunityCard[];
};
