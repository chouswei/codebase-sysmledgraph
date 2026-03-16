/**
 * Symbol → graph mapping: LSP symbol kinds to node labels and edge types.
 * Single place to avoid schema drift. Phase 1 step 5, Phase 2.
 * See GITNEXUS_FEATURES.md and deploy model GraphStore doc.
 */

import type { NodeLabel, EdgeType } from '../types.js';

/**
 * Map LSP DocumentSymbol detail (metaclass name from sysml-v2-lsp) or kind string to graph node label.
 * Covers SysML v2 metaclasses from toMetaclassName(); unmapped kinds fall back to Package or are skipped.
 */
export function symbolKindToNodeLabel(kind: string): NodeLabel | undefined {
  const map: Record<string, NodeLabel> = {
    Package: 'Package',
    PartDefinition: 'PartDef',
    PartUsage: 'PartUsage',
    ConnectionDefinition: 'ConnectionDef',
    ConnectionUsage: 'ConnectionUsage',
    PortDefinition: 'PortDef',
    PortUsage: 'Port',
    RequirementDefinition: 'RequirementDef',
    RequirementUsage: 'RequirementDef',
    Block: 'Block',
    ValueType: 'ValueType',
    ActionDefinition: 'Action',
    ActionUsage: 'Action',
    StateDefinition: 'StateMachine',
    StateUsage: 'StateMachine',
    AttributeDefinition: 'ValueType',
    AttributeUsage: 'ValueType',
    InterfaceDefinition: 'Block',
    InterfaceUsage: 'Block',
    ItemDefinition: 'Block',
    ItemUsage: 'Block',
    OccurrenceDefinition: 'PartDef',
    OccurrenceUsage: 'PartUsage',
  };
  return map[kind];
}

/**
 * Map relation semantics to graph edge type.
 */
export function relationToEdgeType(relation: string): EdgeType | undefined {
  const map: Record<string, EdgeType> = {
    inDocument: 'IN_DOCUMENT',
    inPackage: 'IN_PACKAGE',
    parent: 'PARENT',
    types: 'TYPES',
    references: 'REFERENCES',
    imports: 'IMPORTS',
    satisfy: 'SATISFY',
    derive: 'DERIVE',
    verify: 'VERIFY',
    binding: 'BINDING',
    connectionEnd: 'CONNECTION_END',
  };
  return map[relation];
}
