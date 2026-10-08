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
