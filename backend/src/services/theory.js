'use strict';

const questions = [
  {
    id: 'arrays', skill: 'Arrays', prompt: 'Explain arrays, indexed access, and the costs of insertion and deletion. Compare arrays with linked lists.',
    criteria: [
      { label: 'Contiguous storage', terms: ['contiguous', 'consecutive memory', 'adjacent memory'], guidance: 'Array elements occupy consecutive memory locations.' },
      { label: 'Indexed access', terms: ['index', 'indexed', 'indices'], guidance: 'An index identifies an element; direct access takes O(1) time.' },
      { label: 'Access complexity', terms: ['o(1)', 'constant time'], guidance: 'Computing an element address allows constant-time random access.' },
      { label: 'Insertion and deletion', terms: ['shift', 'shifting', 'move elements'], guidance: 'Insertion or deletion in the middle requires shifting elements, taking O(n) time.' },
      { label: 'Linked-list comparison', terms: ['linked list', 'linked lists'], guidance: 'Linked lists use nodes and links, allow flexible growth, and need traversal for indexed access.' },
    ],
    extension: [
      { label: 'Linear update cost', terms: ['o(n)', 'linear time'], guidance: 'Shifting up to n elements makes middle insertion and deletion linear.' },
      { label: 'Address calculation', terms: ['base address', 'element size'], guidance: 'Address = base address + index multiplied by element size.' },
      { label: 'Capacity trade-off', terms: ['resize', 'resizing', 'capacity'], guidance: 'A dynamic array may need to allocate more capacity and copy its elements.' },
      { label: 'Locality', terms: ['cache', 'locality'], guidance: 'Contiguous storage typically gives arrays good cache locality.' },
      { label: 'Concrete example', terms: ['example', 'arr[', 'a['], guidance: 'Illustrate indexed access and a middle insertion using a short array.' },
    ],
  },
  {
    id: 'stacks', skill: 'Stacks', prompt: 'Explain the stack data structure, its operations, implementation, and applications.',
    criteria: [
      { label: 'LIFO order', terms: ['lifo', 'last in first out', 'last-in-first-out'], guidance: 'The most recently added element is removed first.' },
      { label: 'Push', terms: ['push'], guidance: 'Push adds an element at the top.' },
      { label: 'Pop', terms: ['pop'], guidance: 'Pop removes and returns the top element.' },
      { label: 'Peek', terms: ['peek', 'top element'], guidance: 'Peek reads the top element without removing it.' },
      { label: 'Implementation', terms: ['array', 'linked list'], guidance: 'Use an array with a top index, or a linked list with operations at the head.' },
    ],
    extension: [
      { label: 'Operation complexity', terms: ['o(1)', 'constant time'], guidance: 'A linked stack or fixed-capacity array stack supports push and pop in O(1).' },
      { label: 'Underflow', terms: ['underflow', 'empty stack'], guidance: 'Popping an empty stack causes underflow.' },
      { label: 'Overflow', terms: ['overflow', 'full stack'], guidance: 'A fixed-capacity stack overflows when it is full.' },
      { label: 'Application', terms: ['recursion', 'undo', 'parentheses', 'expression'], guidance: 'Examples include function calls, undo, balanced parentheses, and expression evaluation.' },
      { label: 'Worked sequence', terms: ['example', 'push(1)', 'push 1'], guidance: 'Show two pushes followed by a pop, identifying the returned element.' },
    ],
  },
  {
    id: 'binary-search', skill: 'Binary Search', prompt: 'Explain binary search, its prerequisite, algorithm steps, and time complexity.',
    criteria: [
      { label: 'Sorted input', terms: ['sorted', 'ordered array'], guidance: 'Binary search requires sorted input.' },
      { label: 'Middle element', terms: ['middle', 'midpoint', 'mid'], guidance: 'Compare the target with the middle element of the current interval.' },
      { label: 'Discard half', terms: ['half', 'halve', 'halving'], guidance: 'Keep the left or right half according to the comparison.' },
      { label: 'Successful termination', terms: ['equal', 'found', 'match'], guidance: 'Return the position when the middle element equals the target.' },
      { label: 'Time complexity', terms: ['o(log n)', 'o(logn)', 'logarithmic'], guidance: 'Repeatedly halving the interval gives O(log n) time.' },
    ],
    extension: [
      { label: 'Bounds', terms: ['low', 'left bound'], guidance: 'Initialize low and high bounds to the first and last indices.' },
      { label: 'Unsuccessful termination', terms: ['not found', 'low > high', 'empty interval'], guidance: 'Stop with not found when the search interval is empty.' },
      { label: 'Bound updates', terms: ['mid + 1', 'mid+1', 'mid - 1', 'mid-1'], guidance: 'Exclude the examined middle element by advancing low or decreasing high.' },
      { label: 'Space complexity', terms: ['o(1)', 'constant space'], guidance: 'The iterative implementation uses O(1) auxiliary space.' },
      { label: 'Worked example', terms: ['example', 'trace'], guidance: 'Trace the successive search intervals on a short sorted array.' },
    ],
  },
];

const additionalTopics = [
  ['strings', 'Strings', 'Explain strings, common operations, and the costs of comparison and pattern search.', [
    ['Character sequence', ['character', 'characters'], 'A string is a sequence of characters.'],
    ['Length', ['length'], 'Length is the number of characters under the representation used.'],
    ['Indexing', ['index', 'indices'], 'Indexing accesses a character at a position.'],
    ['Concatenation', ['concatenation', 'concatenate'], 'Concatenation joins strings and may allocate and copy characters.'],
    ['Substring', ['substring'], 'A substring is a contiguous part of a string.'],
    ['Comparison', ['comparison', 'compare'], 'Lexicographic comparison examines corresponding characters until they differ.'],
    ['Linear comparison cost', ['o(n)', 'linear'], 'Comparison may inspect every character and takes linear time in the common-prefix length.'],
    ['Naive search', ['naive', 'brute force'], 'Naive pattern search checks the pattern at each possible start position.'],
    ['Efficient matching', ['kmp', 'prefix function'], 'KMP uses prefix information to avoid repeating comparisons.'],
    ['Example', ['example'], 'Trace a comparison or pattern search on a concrete string.'],
  ]],
  ['linked-lists', 'Linked Lists', 'Explain linked lists, their operations, and their trade-offs compared with arrays.', [
    ['Nodes', ['node', 'nodes'], 'Each node stores data and a link to another node.'],
    ['Head', ['head'], 'The head refers to the first node.'],
    ['Links', ['pointer', 'reference', 'link'], 'Links connect nodes without requiring contiguous storage.'],
    ['Traversal', ['traversal', 'traverse'], 'Follow links from the head to visit nodes.'],
    ['Insertion', ['insert', 'insertion'], 'Insert a node by updating links.'],
    ['Deletion', ['delete', 'deletion'], 'Delete a node by reconnecting the surrounding links.'],
    ['Search complexity', ['o(n)', 'linear'], 'Searching or indexed access requires O(n) traversal in the worst case.'],
    ['Known-position update', ['o(1)', 'constant time'], 'Insertion after a known node takes O(1); locating that node may take O(n).'],
    ['Extra storage', ['memory', 'overhead'], 'Links add memory overhead compared with array storage.'],
    ['Doubly linked lists', ['doubly', 'previous'], 'Doubly linked lists include previous and next links.'],
  ]],
  ['queues', 'Queues', 'Explain queues, enqueue and dequeue, and a circular-array implementation.', [
    ['FIFO', ['fifo', 'first in first out', 'first-in-first-out'], 'The first inserted item is removed first.'],
    ['Enqueue', ['enqueue'], 'Enqueue adds an item at the rear.'],
    ['Dequeue', ['dequeue'], 'Dequeue removes an item from the front.'],
    ['Front and rear', ['front', 'rear'], 'Track the front and rear positions.'],
    ['Implementation', ['array', 'linked list'], 'Queues can use arrays or linked lists.'],
    ['Circular storage', ['circular', 'wrap'], 'A circular queue reuses positions by wrapping around the array.'],
    ['Modulo arithmetic', ['modulo', '%'], 'Advance indices modulo capacity.'],
    ['Complexity', ['o(1)', 'constant time'], 'A circular queue supports enqueue and dequeue in O(1).'],
    ['Empty/full conditions', ['empty', 'full'], 'Use a count or reserved slot to distinguish full and empty states.'],
    ['Application', ['scheduling', 'bfs', 'breadth first'], 'Applications include scheduling and breadth-first search.'],
  ]],
  ['trees', 'Trees', 'Explain binary trees, binary search trees, traversal orders, and search complexity.', [
    ['Hierarchy', ['hierarchy', 'hierarchical'], 'A tree organizes nodes in a hierarchy.'],
    ['Root', ['root'], 'The root is the top node and has no parent.'],
    ['Children', ['child', 'children'], 'Each binary-tree node has at most two children.'],
    ['Leaves', ['leaf', 'leaves'], 'Leaves have no children.'],
    ['BST ordering', ['left', 'smaller'], 'A binary search tree orders smaller keys to the left and larger keys to the right, with a specified duplicate policy.'],
    ['Inorder', ['inorder', 'in-order'], 'Inorder visits the left subtree, root, then right subtree.'],
    ['Preorder', ['preorder', 'pre-order'], 'Preorder visits root before its subtrees.'],
    ['Postorder', ['postorder', 'post-order'], 'Postorder visits the root after its subtrees.'],
    ['Balanced search', ['o(log n)', 'balanced'], 'A balanced BST searches in O(log n) time.'],
    ['Skewed search', ['o(n)', 'skewed'], 'A skewed BST can require O(n) time for search.'],
  ]],
  ['graphs', 'Graphs', 'Explain graph representations, breadth-first search, depth-first search, and their complexity.', [
    ['Vertices', ['vertex', 'vertices', 'nodes'], 'Vertices represent entities in a graph.'],
    ['Edges', ['edge', 'edges'], 'Edges connect pairs of vertices.'],
    ['Adjacency list', ['adjacency list'], 'An adjacency list stores each vertex\'s neighbors.'],
    ['Adjacency matrix', ['adjacency matrix'], 'An adjacency matrix records edges in a V by V table.'],
    ['Directed graphs', ['directed', 'undirected'], 'Directed edges have an orientation; undirected edges connect both ways.'],
    ['BFS', ['bfs', 'breadth-first', 'breadth first'], 'BFS explores vertices by distance from its start using a queue.'],
    ['DFS', ['dfs', 'depth-first', 'depth first'], 'DFS explores a branch before backtracking using recursion or a stack.'],
    ['Visited set', ['visited'], 'Track visited vertices to avoid processing cycles repeatedly.'],
    ['Traversal complexity', ['o(v+e)', 'o(v + e)'], 'With adjacency lists, BFS and DFS run in O(V + E).'],
    ['Application', ['shortest path', 'connectivity'], 'BFS finds shortest paths by edge count in an unweighted graph; traversals also test connectivity.'],
  ]],
  ['dynamic-programming', 'Dynamic Programming', 'Explain dynamic programming, its prerequisites, and memoization versus tabulation with an example.', [
    ['Subproblems', ['subproblem', 'subproblems'], 'Break the problem into smaller subproblems.'],
    ['Overlap', ['overlapping', 'repeated'], 'Dynamic programming is useful when subproblems repeat.'],
    ['Optimal substructure', ['optimal substructure'], 'For optimization problems, optimal substructure lets optimal subsolutions build an optimal solution.'],
    ['Store results', ['store', 'cache'], 'Store computed results to avoid recomputation.'],
    ['Recurrence', ['recurrence', 'transition'], 'Define a recurrence or state transition.'],
    ['Memoization', ['memoization', 'top-down'], 'Memoization computes states on demand using a cache.'],
    ['Tabulation', ['tabulation', 'bottom-up'], 'Tabulation fills a table in dependency order.'],
    ['Base case', ['base case', 'base cases'], 'Initialize base cases before using the recurrence.'],
    ['Complexity', ['states', 'transitions'], 'Time depends on the number of states and work per transition; space depends on stored states.'],
    ['Example', ['fibonacci', 'knapsack'], 'Illustrate the recurrence and stored states using Fibonacci or knapsack.'],
  ]],
];
for (const [id, skill, prompt, rows] of additionalTopics) {
  const rubric = rows.map(([label, terms, guidance]) => ({ label, terms, guidance }));
  questions.push({ id, skill, prompt, criteria: rubric.slice(0, 5), extension: rubric.slice(5) });
}

function findQuestion(id, marks) {
  const question = questions.find(q => q.id === id);
  if (!question || ![5, 10].includes(marks)) return null;
  return { ...question, marks, rubric: marks === 10 ? [...question.criteria, ...question.extension] : question.criteria };
}

function grade(question, answer) {
  const normalized = answer.toLowerCase().replace(/\s+/g, ' ');
  const sentences = normalized.split(/[.!?\n]+/);
  const feedback = question.rubric.map(c => {
    const term = c.terms.find(term => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`);
      return sentences.some(s => pattern.test(s) && !/\b(no|not|never|incorrect|false)\b/.test(s.replace(pattern, ' ')));
    });
    return { label: c.label, marks: term ? 1 : 0, maxMarks: 1, detected: Boolean(term), guidance: c.guidance };
  });
  return { score: feedback.reduce((sum, c) => sum + c.marks, 0), maxMarks: question.marks, feedback, modelAnswer: question.rubric.map(c => c.guidance).join(' '), status: 'estimated', masteryUpdated: false };
}

module.exports = { questions, findQuestion, grade };
