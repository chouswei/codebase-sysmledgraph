/**
 * Shared types for sysmledgraph.
 * Aligns with deploy model and GITNEXUS_FEATURES schema.
 */

/** Node labels in the graph (SysML-native grouping). */
export const NODE_LABELS = [
  'Document',
  'Package',
  'PartDef',
  'PartUsage',
  'ConnectionDef',
  'ConnectionUsage',
  'PortDef',
  'Port',
  'RequirementDef',
  'Block',
  'ValueType',
  'Action',
  'StateMachine',
] as const;

export type NodeLabel = (typeof NODE_LABELS)[number];

/** Edge types in the graph. */
export const EDGE_TYPES = [
  'IN_DOCUMENT',
  'IN_PACKAGE',
  'PARENT',
  'TYPES',
  'REFERENCES',
  'IMPORTS',
  'SATISFY',
  'DERIVE',
  'VERIFY',
  'BINDING',
  'CONNECTION_END',
] as const;

export type EdgeType = (typeof EDGE_TYPES)[number];

/** Document node properties. */
export interface DocumentProps {
  path: string;
  indexedAt?: string;
}

/** Symbol node properties (common). */
export interface SymbolProps {
  name: string;
  qualifiedName?: string;
  path: string;
  [key: string]: unknown;
}

/** A relation from parser/symbol layer for graph edges. */
export interface SymbolRelation {
  from: string; // qualified name or id
  to: string;
  type: EdgeType;
}

/** Normalized symbol shape for graph (from parser). */
export interface NormalizedSymbol {
  label: NodeLabel;
  props: SymbolProps;
  relations: SymbolRelation[];
}

/** Config file at a path (e.g. config.yaml). */
export interface ModelConfig {
  model_dir?: string;
  model_files?: string[];
}
