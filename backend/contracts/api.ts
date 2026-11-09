/** Wire contracts for /api/check and /api/analyze-image; extension legacy fields remain additive. */
export type Assessment = 'SUPPORTED' | 'CONTRADICTED' | 'MIXED' | 'INSUFFICIENT_EVIDENCE' | 'NOT_FACT_CHECKABLE';
export interface Claim { id: string; text: string; checkable: boolean; reason: string }
export interface Citation { url: string; excerpt: string; attributed: boolean; context_sentence: string }
export interface EvidenceSource {
  id: string; url: string; title: string; grounding_chunk_indices: number[];
  publisher: string | null; published_at: string | null;
  inspection_status: 'inspected' | 'unverified'; inspection_error: string | null;
  resolved_url?: string; canonical_urls: string[]; citations: Citation[];
  original_evidence: { identifier: string; author: string; methodology_excerpt: string | null } | null;
  content_hash?: string; text_excerpt?: string;
}
export interface SourceDependency {
  id: string; source_id: string; target_id: string;
  relationship_type: 'explicit_attribution' | 'syndicated_from' | 'cites_original_artifact' | 'distinct_original_evidence';
  evidence: string; supporting_source_url: string; target_url: string;
  verification_status: 'confirmed';
}
export interface IndependenceAnalysis {
  total_articles_inspected: number;
  confirmed_distinct_evidence_origins: number;
  confirmed_original_evidence: { identifier: string; source_id: string }[];
  documented_origin_count: number; confirmed_dependent_articles: number;
  sources_with_unresolved_independence: string[];
  evidence_origins: { id: string; url: string; source_ids: string[]; evidence_edge_ids: string[]; original_artifact_identified: boolean }[];
  dependencies: SourceDependency[];
  unresolved_relationships: { source_ids: string[]; verification_status: 'unresolved'; reason: string; suspected_relationship_type?: 'possible_duplicate_or_syndication'; evidence?: string; supporting_source_urls?: string[] }[];
  limitations: string[];
}
export interface FactCheckResult {
  claim: Claim; assessment: Assessment; evidence_summary: string; explanation: string;
  sources: EvidenceSource[]; independence: IndependenceAnalysis;
  /** Original Vertex grounding metadata; retained indices refer to grounding_chunks. */
  grounding: { grounding_chunks?: unknown[]; grounding_supports?: unknown[];
    web_search_queries?: string[]; search_entry_point?: { rendered_content?: string }; [key: string]: unknown };
  limitations: string[];
}
export interface CheckResponse {
  schema_version: '1.0'; claims: Claim[]; results: FactCheckResult[];
  status: 'supported' | 'contradicted' | 'needs_context' | 'insufficient_evidence';
  summary: string; detail: string; sources: EvidenceSource[];
}
export interface ErrorResponse { error: string; code: 'INVALID_INPUT' | 'RATE_LIMITED' | 'BUSY' | 'HTTP_ERROR' | 'RESEARCH_UNAVAILABLE' }
