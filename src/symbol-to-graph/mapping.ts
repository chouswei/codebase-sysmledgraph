/**
 * Symbol → graph mapping: LSP symbol kinds to node labels and edge types.
 * Single place to avoid schema drift. Phase 1 step 5, Phase 2.
 * See GITNEXUS_FEATURES.md and deploy model GraphStore doc.
 */

import type { NodeLabel, EdgeType } from '../types.js';

/**
 * Map LSP DocumentSymbol detail (SysML metaclass name from the LSP) or kind string to graph node label.
 * Covers SysML v2 metaclasses; also MCP-style kinds (e.g. "package", "requirement def"). Unmapped kinds are skipped.
 */
export function symbolKindToNodeLabel(kind: string): NodeLabel | undefined {
  const map: Record<string, NodeLabel> = {
    Package: 'Package',
    package: 'Package',
    PartDefinition: 'PartDef',
    'part def': 'PartDef',
    PartUsage: 'PartUsage',
    'part usage': 'PartUsage',
    ConnectionDefinition: 'ConnectionDef',
    'connection def': 'ConnectionDef',
    ConnectionUsage: 'ConnectionUsage',
    'connection usage': 'ConnectionUsage',
    PortDefinition: 'PortDef',
    'port def': 'PortDef',
    PortUsage: 'Port',
    'port usage': 'Port',
    RequirementDefinition: 'RequirementDef',
    'requirement def': 'RequirementDef',
    RequirementUsage: 'RequirementDef',
    'requirement usage': 'RequirementDef',
    Block: 'Block',
    block: 'Block',
    ValueType: 'ValueType',
    'value type': 'ValueType',
    ActionDefinition: 'Action',
    'action def': 'Action',
    ActionUsage: 'Action',
    'action usage': 'Action',
    StateDefinition: 'StateMachine',
    'state def': 'StateMachine',
    StateUsage: 'StateMachine',
    'state usage': 'StateMachine',
    AttributeDefinition: 'ValueType',
    'attribute def': 'ValueType',
    AttributeUsage: 'ValueType',
    'attribute usage': 'ValueType',
    InterfaceDefinition: 'Block',
    'interface def': 'Block',
    InterfaceUsage: 'Block',
    'interface usage': 'Block',
    ItemDefinition: 'Block',
    'item def': 'Block',
    ItemUsage: 'Block',
    'item usage': 'Block',
    OccurrenceDefinition: 'PartDef',
    'occurrence def': 'PartDef',
    OccurrenceUsage: 'PartUsage',
    'occurrence usage': 'PartUsage',
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
