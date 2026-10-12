// Self-check for graph.js. Run: node check.js
const assert = require('assert');
const { deriveStates, buildElkGraph } = require('./graph.js');

const dep = (on, type = 'blocks') => ({ depends_on_id: on, type });
const issues = [
  { id: 'e', issue_type: 'epic', status: 'open', title: 'Epic' },
  { id: 'a', issue_type: 'task', status: 'closed', parent: 'e', dependencies: [dep('e', 'parent-child')] },
  { id: 'b', issue_type: 'task', status: 'open', parent: 'e', dependencies: [dep('a'), dep('e', 'parent-child')] },
  { id: 'c', issue_type: 'task', status: 'open', dependencies: [dep('b')] },
  { id: 'd', issue_type: 'task', status: 'in_progress', dependencies: [dep('missing')] },
];

const s = deriveStates(issues);
assert.strictEqual(s.get('a'), 'closed');
assert.strictEqual(s.get('b'), 'ready', 'closed blocker does not block');
assert.strictEqual(s.get('c'), 'blocked', 'open blocker blocks');
assert.strictEqual(s.get('d'), 'in_progress');
assert.strictEqual(s.get('e'), 'ready', 'parent-child link does not block');

const g = buildElkGraph(issues);
const epic = g.children.find((n) => n.id === 'e');
assert.deepStrictEqual(epic.children.map((n) => n.id), ['a', 'b'], 'children sit inside their epic');
assert.deepStrictEqual(g.children.map((n) => n.id).sort(), ['c', 'd', 'e'], 'orphans stay at root');
assert.deepStrictEqual(g.edges.map((e) => e.id), ['a->b', 'b->c'], 'blocker -> blocked; no parent-child or dangling edges');

console.log('ok');
