export type { FindingRecommendation, RecommendationInput } from "./types";
export {
  buildFindingRecommendation,
  buildGroupedActionRecommendation,
  buildGroupedBrokenLinkRecommendation,
} from "./build-recommendation";
export { applyGroupedRecommendations } from "./apply-grouped-recommendations";
