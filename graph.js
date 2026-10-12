// Pure data logic: bd JSON -> derived states + ELK input graph.
// Loaded by index.html in the browser and by check.js in Node.

const NODE_W = 230;
const NODE_H = 84;

// Effective state: bd only stores open/in_progress/closed/deferred;
// "blocked" vs "ready" comes from whether any blocker is still open.
function deriveStates(issues) {
  const byId = new Map(issues.map((i) => [i.id, i]));
  const states = new Map();
  for (const i of issues) {
    if (i.status !== 'open') {
      states.set(i.id, i.status);
      continue;
    }
    const blocked = (i.dependencies || []).some((d) => {
      if (d.type !== 'blocks') return false;
      const dep = byId.get(d.depends_on_id);
      return dep && dep.status !== 'closed';
    });
    states.set(i.id, blocked ? 'blocked' : 'ready');
  }
  return states;
}

// Epics become compound nodes holding their children; "blocks" deps become
// edges from blocker to blocked so the graph reads left-to-right in work order.
function buildElkGraph(issues) {
  const ids = new Set(issues.map((i) => i.id));
  const epics = new Map();
  for (const i of issues) {
    if (i.issue_type === 'epic') {
      epics.set(i.id, {
        id: i.id,
        labels: [{ text: `${i.id}  ${i.title}`, width: NODE_W, height: 18 }],
        layoutOptions: { 'elk.padding': '[top=34,left=16,bottom=16,right=16]' },
        children: [],
      });
    }
  }
  const root = [];
  for (const i of issues) {
    if (epics.has(i.id)) continue;
    const node = { id: i.id, width: NODE_W, height: NODE_H };
    const parent = i.parent && epics.get(i.parent);
    (parent ? parent.children : root).push(node);
  }
  for (const e of epics.values()) root.push(e);

  const edges = [];
  for (const i of issues) {
    for (const d of i.dependencies || []) {
      if (d.type !== 'blocks' || !ids.has(d.depends_on_id)) continue;
      edges.push({
        id: `${d.depends_on_id}->${i.id}`,
        sources: [d.depends_on_id],
        targets: [i.id],
      });
    }
  }

  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.spacing.nodeNode': '22',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
      'elk.spacing.edgeNode': '16',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '10',
    },
    children: root,
    edges,
  };
}

if (typeof module !== 'undefined') module.exports = { deriveStates, buildElkGraph, NODE_W, NODE_H };
