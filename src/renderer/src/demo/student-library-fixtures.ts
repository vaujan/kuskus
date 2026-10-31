import type { CollectionDto, LibraryItemDto } from '../../../shared/library-contract'
import { SAMPLE_NOTE } from '../features/items/note-story-fixtures'

// Original student notes and real bookmarks. No generated photographs or borrowed lecture files.
export const studentCollections: CollectionDto[] = [
  {
    schemaVersion: 2,
    id: 'data-structures',
    name: 'Data Structures',
    icon: 'code',
    createdAt: '2026-09-01T09:00:00.000Z',
    relativePath: 'Data Structures',
    parentId: null
  },
  {
    schemaVersion: 2,
    id: 'web-development',
    name: 'Web Development',
    icon: 'code',
    createdAt: '2026-09-01T09:00:00.000Z',
    relativePath: 'Web Development',
    parentId: null
  },
  {
    schemaVersion: 2,
    id: 'discrete-math',
    name: 'Discrete Math',
    icon: 'school',
    createdAt: '2026-09-01T09:00:00.000Z',
    relativePath: 'Discrete Math',
    parentId: null
  },
  {
    schemaVersion: 2,
    id: 'side-projects',
    name: 'Side Projects',
    icon: 'rocket',
    createdAt: '2026-09-01T09:00:00.000Z',
    relativePath: 'Side Projects',
    parentId: null
  },
  {
    schemaVersion: 2,
    id: 'read-later',
    name: 'Read Later',
    icon: 'bookmark',
    createdAt: '2026-09-01T09:00:00.000Z',
    relativePath: 'Read Later',
    parentId: null
  }
]

interface StudyEntry {
  title: string
  body?: string
  url?: string
  description?: string
}

const entries: StudyEntry[][] = [
  [
    {
      title: 'Stacks & queues',
      body: 'A stack remembers the most recent thing; a queue handles the oldest thing first.\n\n| Structure | Add | Remove | Where I used it |\n| --- | --- | --- | --- |\n| Stack | push | pop | Matching brackets |\n| Queue | enqueue | dequeue | Breadth-first search |\n\n## Python reminder\n\n```python\nfrom collections import deque\n\nqueue = deque(["start"])\nqueue.append("next")\ncurrent = queue.popleft()\n```\n\nUse a list for a stack. Use deque for a queue so removing the first element does not shift everything.\n\n- [x] Trace both by hand\n- [ ] Solve the bracket problem without looking at my previous answer\n- [ ] Ask when a bounded deque is useful'
    },
    {
      title: 'Why is my BFS visiting nodes twice?',
      body: 'The diamond graph exposed it: A connects to B and C; both connect to D. I was marking a node visited only after removing it from the queue.\n\n## Fix\n\nMark it when adding it to the queue. Otherwise B and C can both enqueue D.\n\n```python\nseen = {start}\nqueue = deque([start])\nwhile queue:\n    node = queue.popleft()\n    for neighbor in graph[node]:\n        if neighbor not in seen:\n            seen.add(neighbor)\n            queue.append(neighbor)\n```\n\nThis assumes deque is imported and every node has an adjacency-list entry.\n\nNext: keep a parent dictionary so I can reconstruct the shortest path. BFS gives shortest paths here because every edge has the same cost.'
    },
    {
      title: 'Big O \u2014 what actually grows?',
      body: 'Count work as the input grows, not seconds on my laptop.\n\n| Operation | Time | Caveat |\n| --- | --- | --- |\n| List indexing | O(1) | Index is already known |\n| Binary search | O(log n) | Sorted random-access sequence |\n| Linear scan | O(n) | May inspect every element |\n| Merge sort | O(n log n) | Extra storage needed |\n| All pairs | O(n\u00b2) | Two independent loops over n |\n\nTwo consecutive loops are O(n), not O(n\u00b2). A nested loop is not automatically quadratic if the inner range stays fixed.\n\n## Check myself\n\nIf n doubles, a quadratic algorithm does roughly four times the work. Try counting comparisons for n = 8, 16, 32 before timing anything.'
    },
    {
      title: 'Binary search: stop guessing the boundaries',
      body: 'Use a half-open interval [lo, hi). Everything before lo is too small; everything at or beyond hi is outside the remaining search.\n\n```python\ndef lower_bound(values, target):\n    lo, hi = 0, len(values)\n    while lo < hi:\n        mid = (lo + hi) // 2\n        if values[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid\n    return lo\n```\n\nReturns the first position whose value is at least target, or len(values). It does not promise that target exists.\n\n- [x] Empty input\n- [x] Target before the first value\n- [ ] Duplicates: [2, 2, 2, 5]\n- [ ] Explain why the interval shrinks each iteration'
    },
    {
      title: 'Week 4 \u2014 practice problems',
      body: '## Before the tutorial\n\n- [x] Reverse an array in place with two pointers\n- [x] Implement a stack using a list\n- [ ] Balanced brackets \u2014 handle an unmatched closing bracket\n- [ ] Merge two sorted lists without sorting again\n- [ ] Detect a cycle using slow and fast pointers\n\n## Mistakes worth keeping\n\nMy bracket solution accepted ")(" because it checked only the final count. Order matters. A stack should fail as soon as there is no matching opening bracket.\n\nRetry the two failed questions tomorrow with a blank editor. Write the invariant before the code.'
    },
    {
      title: 'Trees \u2014 traversal without memorising',
      body: 'Preorder visits the node before its children. Inorder puts the node between left and right. Postorder visits it last.\n\nFor root 8, left child 3, right child 10:\n\n- Preorder: 8, 3, 10\n- Inorder: 3, 8, 10\n- Postorder: 3, 10, 8\n\nInorder produces sorted output for a binary search tree, not every binary tree.\n\n## Questions for office hours\n\n- What changes when duplicate keys are allowed?\n- Why can an unbalanced BST search degrade to O(n)?\n- Can I implement inorder with an explicit stack?'
    },
    {
      title: 'Hash tables: collisions are expected',
      body: 'A collision means different keys land in the same bucket. It does not mean the keys are equal.\n\n## Two strategies\n\nSeparate chaining stores multiple entries per bucket. Open addressing searches for another slot using a probing rule.\n\nAverage lookup can be O(1) with suitable hashing and load control. Worst-case lookup can still be O(n). Resizing costs work now to keep later operations cheap.\n\n## Small experiment\n\nHash integers with key % 5. Insert 3, 8, 13, 4. Draw the buckets, then look up 18. The bucket matches but the key does not.\n\nStill need to review deletion with open addressing.'
    },
    {
      title: 'Recursion \u2014 trace the return, too',
      body: 'I keep tracing the calls down and forgetting how the answers come back.\n\n```python\ndef tree_size(node):\n    if node is None:\n        return 0\n    return 1 + tree_size(node.left) + tree_size(node.right)\n```\n\nFor a leaf: 1 + 0 + 0 = 1. For a root with two leaves: 1 + 1 + 1 = 3.\n\n## Before writing a recursive function\n\n1. What is the smallest input?\n2. Does each call move toward it?\n3. What does each call promise to return?\n\nSpace follows the maximum active call depth. A skewed tree can use O(n) stack space. Try the iterative version next.'
    },
    {
      title: 'Sorting lab \u2014 keep the experiment fair',
      body: 'Compare insertion sort and merge sort using the same input values. Copy the input before each run so the second algorithm does not receive an already sorted list.\n\n## Input families\n\n- Random values\n- Already sorted\n- Reverse sorted\n- Many duplicates\n\nRecord several runs, not one. Keep input generation outside the timer. Check the output against sorted(original) before trusting a timing result.\n\nPrediction: insertion sort should do well on nearly sorted small inputs. Need measurements before writing the conclusion.\n\n- [ ] Add comparison counts\n- [ ] Plot time against input size\n- [ ] Explain the difference between stability and in-place sorting'
    },
    {
      title: 'Midterm revision \u2014 explain it out loud',
      body: '## Can I explain these without notes?\n\n- [x] Stack vs queue, with a real example\n- [x] Why binary search needs sorted input\n- [ ] BFS vs DFS: traversal order, storage, use cases\n- [ ] Average vs worst-case hash-table lookup\n- [ ] Why a BST is not automatically balanced\n\n## Friday plan\n\n25 minutes: trace one graph by hand.\n25 minutes: solve two boundary-case problems.\n10 minutes: write down anything I still cannot explain.\n\nDo not spend the whole session rereading. The useful part is finding where I get stuck.'
    },
    {
      title: 'VisuAlgo \u2014 animate the algorithm',
      url: 'https://visualgo.net/en',
      description:
        'Run a small graph by hand first, then compare the queue and traversal order with the animation.'
    },
    {
      title: 'Python collections \u2014 deque & Counter',
      url: 'https://docs.python.org/3/library/collections.html',
      description:
        'Reference for the queue in my BFS exercise. Revisit Counter before the word-frequency task.'
    }
  ],
  [
    {
      title: 'React \u2014 thinking in components',
      url: 'https://react.dev/learn',
      description:
        'Work through the interactive examples, then split the course planner into components with clear responsibilities.'
    },
    {
      title: 'JavaScript.info \u2014 revisit the fundamentals',
      url: 'https://javascript.info/',
      description:
        'Read closures and promises with the console open. Write a small example before moving to the next chapter.'
    },
    {
      title: 'web.dev \u2014 learn CSS',
      url: 'https://web.dev/learn/css',
      description:
        'Try the sizing and layout exercises on the dashboard. Keep notes on the rules I keep looking up.'
    },
    {
      title: 'web.dev \u2014 learn accessibility',
      url: 'https://web.dev/learn/accessibility',
      description:
        'Use the keyboard and focus lessons to review my signup form. Apply one lesson per session.'
    },
    {
      title: 'Flexbox vs grid \u2014 my rule of thumb',
      body: 'Flexbox is useful when the main relationship is along one axis. Grid is useful when rows and columns need to line up together. Neither is limited to a particular kind of page.\n\n## Student dashboard\n\nUse grid for the page: navigation, main content, upcoming deadlines. Use flex for the row of filter buttons inside the content.\n\n```css\n.dashboard {\n  display: grid;\n  grid-template-columns: 14rem minmax(0, 1fr);\n  gap: 1.5rem;\n}\n```\n\nThe minmax prevents a wide code block from forcing the main column wider than the container. Need a narrow-screen layout before calling this finished.'
    },
    {
      title: 'Fetch does not reject on a 404',
      body: 'My catch block never ran for a missing endpoint. A response can arrive successfully while the HTTP status indicates failure. Check response.ok before reading the body.\n\n```javascript\nasync function loadCourses() {\n  const response = await fetch("/api/courses");\n  if (!response.ok) {\n    throw new Error(`Request failed: ${response.status}`);\n  }\n  return response.json();\n}\n```\n\n## UI states to handle\n\n- Loading\n- Success with results\n- Success with no results\n- Request failure with a retry button\n\nAlso test invalid JSON. A 200 response does not guarantee the response body has the shape I expect.'
    },
    {
      title: 'JavaScript closures \u2014 the counter example',
      body: 'A function can keep access to variables from the scope where it was created.\n\n```javascript\nfunction makeCounter() {\n  let count = 0;\n  return () => ++count;\n}\nconst next = makeCounter();\nnext(); // 1\nnext(); // 2\n```\n\nEach call to makeCounter creates a separate count. Two functions returned by the same call could share that variable.\n\n## Still confusing\n\nA closure does not freeze a variable at its original value. It keeps access to the binding. Try returning both increment and read functions from the same factory.'
    },
    {
      title: 'Forms \u2014 labels before styling',
      body: 'The placeholder disappears as soon as someone types. Use a visible label.\n\n```html\n<label for="email">University email</label>\n<input id="email" name="email" type="email" autocomplete="email">\n```\n\n## Signup exercise\n\n- [x] Connect each label to its input\n- [ ] Make errors specific: explain how to fix them\n- [ ] Keep entered values after a failed submission\n- [ ] Test with just the keyboard\n\nA disabled submit button with no explanation is frustrating. Let people submit and explain what needs attention.'
    },
    {
      title: 'CSS specificity \u2014 why that rule lost',
      body: 'Check the cascade before adding !important. A selector can match and still lose.\n\n## Debugging order\n\n1. Inspect the element and confirm the rule matches.\n2. Look for crossed-out declarations.\n3. Check origin, importance, cascade layers, and specificity.\n4. If those tie, later source order wins.\n\nMy button color came from an ID selector left in the exercise stylesheet. Removing that selector was cleaner than making every new selector stronger.\n\nNext time: keep component selectors shallow and inspect computed styles earlier.'
    },
    {
      title: 'HTTP \u2014 request and response notes',
      body: 'A request has a method, URL, headers, and sometimes a body. The response has a status, headers, and usually a body.\n\n| Status | Meaning in my app |\n| --- | --- |\n| 200 | Loaded the resource |\n| 201 | Created a new record |\n| 204 | Success with no response body |\n| 400 | Request needs correction |\n| 404 | Resource not found |\n| 500 | Server failed |\n\nDo not call response.json() on an empty 204 response.\n\nQuestion: when should a form validation error use 400 vs 422? Read the API convention before choosing.'
    },
    {
      title: 'Portfolio \u2014 responsive layout checklist',
      body: 'Test the content, not just the device presets. Long project titles and wide code snippets are useful stress cases.\n\n- [x] Add the viewport meta tag\n- [x] Let project cards wrap naturally\n- [ ] Check at 320 px with a long title\n- [ ] Make screenshots shrink inside their container\n- [ ] Keep keyboard focus visible\n- [ ] Verify navigation at 200% zoom\n\nThe desktop layout looked fine but the project links were too close together on my phone. Increase spacing and keep the whole label clickable.'
    },
    {
      title: 'MDN \u2014 learn web development',
      url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development',
      description:
        'Work through the fundamentals instead of jumping between unrelated tutorials. Use the exercises to check understanding.'
    },
    {
      title: 'MDN \u2014 using the Fetch API',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch',
      description:
        'Read alongside my request-state exercise. Especially response status handling and cancellation.'
    },
    {
      title: 'MDN \u2014 CSS grid layout',
      url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout',
      description:
        'Reference while building the course dashboard. Check track sizing before adding another fixed width.'
    }
  ],
  [
    {
      title: 'Induction \u2014 the step I keep skipping',
      body: 'To prove 1 + 2 + \u2026 + n = n(n + 1)/2 for positive integers:\n\n## Base case\n\nn = 1: both sides equal 1.\n\n## Inductive step\n\nAssume the formula for k. Then add k + 1:\n\n$$\\frac{k(k+1)}{2} + (k+1) = \\frac{(k+1)(k+2)}{2}$$\n\nThat is the formula for k + 1. The assumption must be stated before using it.\n\n- [x] Rewrite without looking\n- [ ] Try the sum of the first n odd numbers\n- [ ] Explain why checking five examples is not a proof'
    },
    {
      title: 'Logic \u2014 implication is not causation',
      body: 'P implies Q is false only when P is true and Q is false. It does not say P caused Q.\n\n| P | Q | P \u2192 Q |\n| --- | --- | --- |\n| T | T | T |\n| T | F | F |\n| F | T | T |\n| F | F | T |\n\nThe contrapositive, not Q implies not P, is equivalent to the original statement. The converse is not generally equivalent.\n\nExample: divisible by 4 implies even. Even does not imply divisible by 4. Use 6 as the counterexample.'
    },
    {
      title: 'Quantifiers \u2014 order changes the claim',
      body: 'For every student, there exists a book they like. This allows different books for different students.\n\nThere exists a book that every student likes. This requires one shared book.\n\n## Negation practice\n\nOriginal: every input has an output.\nNegation: there exists an input with no output.\n\nNegate one quantifier at a time and push the negation inward.\n\n- [ ] Translate three examples into symbols\n- [ ] Find a counterexample for the reversed order\n- [ ] Ask about the empty-domain case in the tutorial'
    },
    {
      title: 'Sets \u2014 a small inclusion-exclusion example',
      body: '18 students take Python, 14 take Java, and 6 take both.\n\nThe union has 18 + 14 \u2212 6 = 26 students. The overlap was counted twice, so subtract it once.\n\nIf the class has 30 students, 4 take neither.\n\n## Before calculating\n\nWrite down the universe. Draw the overlap. Check whether the question says \u201cor\u201d inclusively or \u201cexactly one.\u201d\n\nExactly one here is (18 \u2212 6) + (14 \u2212 6) = 20. That is different from the union.\n\nNext: extend to three sets without forgetting the triple intersection.'
    },
    {
      title: 'Counting \u2014 choose or arrange?',
      body: 'Ask whether order changes the outcome.\n\nChoosing 3 committee members from 8: C(8, 3) = 56. Assigning president, secretary, and treasurer from 8: 8 \u00d7 7 \u00d7 6 = 336.\n\nThe committee is unordered; the roles are distinct.\n\n## Mistake from the worksheet\n\nI used permutations for a pizza topping selection. Choosing mushroom then olive is the same selection as olive then mushroom.\n\n- [x] Redo committee question\n- [ ] Try a question with repetition allowed\n- [ ] Write assumptions about distinct objects explicitly'
    },
    {
      title: 'Graph theory \u2014 degree sanity check',
      body: 'For a finite undirected graph, the sum of vertex degrees equals twice the number of edges. Each edge contributes two endpoints; a self-loop contributes two to its vertex degree.\n\nFor degrees 3, 2, 2, 1, the sum is 8, so there are 4 edges.\n\n## Useful consequence\n\nThe number of odd-degree vertices is even. If a drawing seems to have three odd-degree vertices, recount.\n\nDo not transfer this formula blindly to directed graphs: total indegree and total outdegree each equal the edge count.'
    },
    {
      title: 'Relations \u2014 equivalence vs partial order',
      body: 'An equivalence relation is reflexive, symmetric, and transitive. A partial order is reflexive, antisymmetric, and transitive.\n\n## Examples\n\nSame remainder modulo 3 is an equivalence relation on integers. The classes group integers by remainder.\n\nSubset inclusion is a partial order on sets. Two sets can be incomparable when neither contains the other.\n\nAntisymmetric does not mean \u201cnever symmetric.\u201d It means if aRb and bRa, then a = b.\n\nNeed to practice drawing a Hasse diagram with four subsets.'
    },
    {
      title: 'Proof methods \u2014 choose a starting point',
      body: '## Direct\n\nStart with the hypothesis and work toward the conclusion. For even a and b, write a = 2m and b = 2n. Then a + b = 2(m + n).\n\n## Contrapositive\n\nProve not Q implies not P. Useful when the negated conclusion has a simpler form.\n\n## Contradiction\n\nAssume the claim is false and derive something impossible. Be explicit about what contradicts what.\n\n## Counterexample\n\nOne counterexample disproves a universal claim. It does not prove the opposite universal claim.\n\nBefore writing: list the assumptions and the exact statement to prove.'
    },
    {
      title: 'Before the quiz \u2014 questions for the tutorial',
      body: '- [x] Does \u201cor\u201d include both unless stated otherwise? Yes.\n- [ ] Can a relation be symmetric and antisymmetric at the same time? Bring the equality relation as a candidate.\n- [ ] When is strong induction clearer than ordinary induction?\n- [ ] Does a path allow repeated vertices in our course terminology? Check the lecture definition.\n\nBring worksheet questions 6 and 9. I can reproduce the solutions but cannot yet explain why those proof methods were chosen.\n\nRevision plan: one proof, one counting problem, one relation example. Check reasoning before checking the numerical answer.'
    },
    {
      title: 'MIT \u2014 Mathematics for Computer Science',
      url: 'https://ocw.mit.edu/courses/6-042j-mathematics-for-computer-science-spring-2015/',
      description:
        'Extra explanations and exercises for proofs, counting, and graphs. Match the topic to this week\u2019s lecture first.'
    }
  ],
  [
    {
      title: 'Study timer \u2014 keep the first version small',
      body: 'A timer for focused study sessions, with a short break after each session. Building this to practice browser state and time handling.\n\n## First version\n\n- [x] Start a 25-minute session\n- [ ] Pause and resume\n- [ ] Reset with a clear button\n- [ ] Choose a short break\n\nStore a target timestamp and calculate remaining time from the clock. Counting interval ticks drifts when the browser throttles background tabs.\n\nLeave accounts, charts, and streaks out of the first version. Done means I can use it for one real study session.'
    },
    {
      title: 'Study timer \u2014 bugs from using it',
      body: '## Found during one algorithms session\n\n- Switching tabs made the countdown inaccurate. Use a deadline instead of subtracting one every interval.\n- Pressing Start twice created two intervals. Clear the old interval before starting another.\n- Reset while paused left the button saying Resume. Derive the label from the timer state.\n\n## Recheck\n\n- [ ] Pause for 10 seconds, resume, check remaining time\n- [ ] Background the tab for a minute\n- [ ] Reset at zero\n- [ ] Test reduced-motion preferences before adding an animation'
    },
    {
      title: 'Course planner \u2014 data model sketch',
      body: 'Keep courses separate from assignments. An assignment belongs to one course; a course can have many assignments.\n\n```sql\nCREATE TABLE courses (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL\n);\nCREATE TABLE assignments (\n  id INTEGER PRIMARY KEY,\n  course_id INTEGER NOT NULL REFERENCES courses(id),\n  title TEXT NOT NULL,\n  due_at TEXT,\n  completed INTEGER NOT NULL DEFAULT 0\n);\n```\n\nSQLite foreign-key enforcement must be enabled for the connection. Decide whether due_at is a date or a timestamp before adding reminders.\n\nNext: insert two courses and query incomplete assignments with their course names.'
    },
    {
      title: 'CLI flashcards \u2014 session flow',
      body: 'A terminal app that asks a question, waits for Enter, then reveals the answer. Useful for definitions before the discrete math quiz.\n\n## Card format\n\n```json\n{\n  "question": "What does BFS use to track the frontier?",\n  "answer": "A queue",\n  "topic": "graphs"\n}\n```\n\nShuffle a copy of the card list. At the end, show missed cards and offer another pass.\n\n- [x] Read cards from a JSON file\n- [ ] Handle an empty card file\n- [ ] Report malformed JSON with the filename\n- [ ] Try it with ten actual questions'
    },
    {
      title: 'Git \u2014 rescue my local changes',
      body: 'Before trying commands from a forum, run git status and read the diff.\n\n## Useful distinctions\n\n- Working tree: changes I have made\n- Staging area: changes prepared for the next commit\n- Commit: a recorded snapshot\n\n```bash\ngit status\ngit diff\ngit diff --staged\n```\n\nMade a practice repository to try staging one file at a time. It is easier to understand commits when each one describes one small change.\n\nStill need to practice resolving a conflict on a throwaway branch. Do not learn destructive reset commands on the course project.'
    },
    {
      title: 'README outline for the course planner',
      body: '## What it does\n\nTrack assignments by course and show what is due next.\n\n## What a classmate needs\n\n- The runtime version\n- Installation and run commands\n- A small example dataset\n- A screenshot after the interface works\n- Known limitations\n\nTry the instructions from a fresh checkout before publishing. My current setup depends on a database file that is ignored by Git, so add a seed command.\n\n- [ ] Explain how to create the database\n- [ ] Include an example without personal course data\n- [ ] Ask a friend to follow the instructions'
    },
    {
      title: 'Testing \u2014 cases I forgot the first time',
      body: 'For the assignment sorter, \u201cworks with three normal tasks\u201d is not enough.\n\n| Case | Expected behavior |\n| --- | --- |\n| No assignments | Empty list |\n| One assignment | Same assignment |\n| Same due date | Preserve a predictable order |\n| Missing due date | Place after dated tasks |\n| Completed task | Excluded from upcoming view |\n\nKeep the sorting function independent of rendering so I can test it directly.\n\nDate-only deadlines need an explicit interpretation. A local calendar date should not unexpectedly move to yesterday after UTC conversion.'
    },
    {
      title: 'Project log \u2014 first usable weekend',
      body: '## Saturday\n\nGot course creation and the assignment list working. Hardcoded the initial courses to focus on the form behavior.\n\n## Sunday\n\nReplaced the hardcoded courses with database records. Found that deleting a course needs a deliberate policy for its assignments. Paused that feature until I decide what the UI should promise.\n\n## Next session\n\n- [ ] Persist completion state\n- [ ] Show a useful empty state\n- [ ] Try it with next week\u2019s actual assignments\n\nThe useful milestone is replacing my paper deadline list for one week, not adding more screens.'
    },
    {
      title: 'Python tutorial \u2014 modules and files',
      url: 'https://docs.python.org/3/tutorial/',
      description:
        'Reference for splitting the flashcard script into small modules and reading its data file.'
    },
    {
      title: 'Git \u2014 the official book',
      url: 'https://git-scm.com/book/en/v2',
      description:
        'Read the branching chapter before the group project. Practice merges in a separate repository.'
    }
  ],
  [
    {
      title: 'Computer science — a study roadmap',
      url: 'https://roadmap.sh/computer-science',
      description:
        'Compare with the semester topics. Use this to spot gaps, not as another checklist to finish this week.'
    },
    {
      title: 'MIT \u2014 The Missing Semester',
      url: 'https://missing.csail.mit.edu/',
      description:
        'Saved for the shell and Git material. Start with one lecture and reproduce the commands locally.'
    },
    {
      title: 'CS50 \u2014 revisit the foundations',
      url: 'https://cs50.harvard.edu/x/',
      description:
        'Return to the algorithms and memory material when the lecture notes feel too compressed.'
    },
    {
      title: 'The Rust Programming Language',
      url: 'https://doc.rust-lang.org/book/',
      description:
        'Curious about ownership. Save for after the current Python assignment rather than starting another course tonight.'
    },
    {
      title: 'PostgreSQL \u2014 SQL tutorial',
      url: 'https://www.postgresql.org/docs/current/tutorial.html',
      description:
        'Read after finishing the SQLite planner. Compare joins and constraints using a tiny dataset.'
    },
    {
      title: 'Pro Git \u2014 branching practice',
      url: 'https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell',
      description:
        'Do this before the next group assignment. Draw the commits, then reproduce the branch history.'
    },
    {
      title: 'SQLite \u2014 foreign key support',
      url: 'https://www.sqlite.org/foreignkeys.html',
      description:
        'Check connection setup and deletion behavior before adding course deletion to the planner.'
    },
    {
      title: 'Reading queue \u2014 one thing at a time',
      body: '## This week\n\nFinish the BFS exercise, then watch the shell material from Missing Semester. Take notes only on commands I actually try.\n\n## After the quiz\n\n- [ ] Work through the Git branching exercise\n- [ ] Try a SQL join using course planner data\n\n## Later\n\nRust can wait. I have enough unfinished Python exercises already.\n\nFor each bookmark: write why I saved it and what I want to do with it. If I cannot remember either, I probably do not need to keep it.'
    },
    {
      title: 'Things that finally clicked this week',
      body: '- Binary search is easier when I choose one interval convention and stick to it.\n- Marking BFS nodes when enqueuing prevents duplicate frontier entries.\n- An HTTP error is not the same as a network error.\n- For induction, the assumption is part of the proof, not an optional introduction.\n\n## Next week\n\nSpend the first ten minutes solving something from memory. Then use the saved references to fill the gaps.\n\nWant to keep this note going so revision starts with the ideas I actually struggled with, instead of an enormous list of everything in the syllabus.'
    }
  ]
]

export const studentItems: LibraryItemDto[] = entries.flatMap((group, folderIndex) => {
  const folder = studentCollections[folderIndex]
  return group.map((entry, itemIndex): LibraryItemDto => {
    const id = `student-${folder.id}-${itemIndex + 1}`
    const timestamp = new Date(
      Date.UTC(2026, 8, 24 - itemIndex, 16 - folderIndex, itemIndex * 3)
    ).toISOString()
    const shared = {
      schemaVersion: 2 as const,
      id,
      title: entry.title,
      createdAt: timestamp,
      updatedAt: timestamp,
      location: { type: 'collection' as const, collectionId: folder.id },
      referencedAttachment: false as const
    }
    if (entry.url) {
      const domain = new URL(entry.url).hostname
      return {
        ...shared,
        type: 'url',
        sourceUrl: entry.url,
        domain,
        siteName: domain,
        description: entry.description ?? null,
        contentKind: 'webpage',
        metadataVersion: 1,
        hasFavicon: true,
        hasPreviewImage: true,
        metadataStatus: 'ready',
        metadataError: null,
        relativePath: `${folder.relativePath}/${entry.title}.url`
      }
    }
    return {
      ...SAMPLE_NOTE,
      ...shared,
      type: 'note',
      body: `# ${entry.title}\n\n${entry.body}`,
      relativePath: `${folder.relativePath}/${entry.title}.md`
    }
  })
})
