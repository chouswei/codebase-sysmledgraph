/**
 * Index pipeline phases. Aligns with behaviour model SysmledgraphBehaviour::IndexPipelineStates
 * (discovering → loadOrdering → parsing → mapping → writing → complete).
 * Source: sysml-v2-models/projects/sysmledgraph/models/behaviour-sysmledgraph.sysml
 */

export const INDEX_PIPELINE_PHASES = [
  'discovering',
  'loadOrdering',
  'parsing',
  'mapping',
  'writing',
  'complete',
] as const;

export type IndexPipelinePhase = (typeof INDEX_PIPELINE_PHASES)[number];
