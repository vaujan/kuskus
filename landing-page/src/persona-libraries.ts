import type { CollectionDto, LibraryDto, LibraryItemDto } from '../../src/shared/library-contract'
import { SAMPLE_NOTE } from '../../src/renderer/src/features/items/note-story-fixtures'
import {
  studentCollections,
  studentItems
} from '../../src/renderer/src/demo/student-library-fixtures'
import type { DemoPersonaId } from './demo-personas'

interface DemoEntry {
  title: string
  body?: string
  url?: string
  description?: string
}
interface DemoFolder {
  name: string
  icon: CollectionDto['icon']
  entries: DemoEntry[]
}
const folders: Record<Exclude<DemoPersonaId, 'student'>, DemoFolder[]> = {
  developer: [
    {
      name: 'Course planner',
      icon: 'code',
      entries: [
        {
          title: 'Before I open another tab',
          body: 'The planner is for students who want one reliable view of upcoming assignments. The first release should replace a paper deadline list for one week.\n\n## Shipping this week\n\n- [x] Course list and assignment form\n- [x] Persist completion state\n- [ ] Handle overdue assignments\n- [ ] Test a fresh installation\n\nKeep the scope small. Notifications can wait until date handling is trustworthy.'
        },
        {
          title: 'API contract \u2014 assignments',
          body: 'GET /api/assignments returns a list, including an empty list when there are no assignments. POST validates the course before inserting.\n\n```json\n{"courseId": 3, "title": "Graph traversal lab", "dueDate": "2026-10-29"}\n```\n\nDue dates are local calendar dates, not instants. Reject invalid dates at the boundary. Return field errors the form can associate with its inputs.\n\nQuestion for tomorrow: should completed assignments be included by default?'
        },
        {
          title: 'Decision \u2014 SQLite for the first release',
          body: 'The app runs locally and does not need a shared server. SQLite keeps setup small and gives us constraints and transactions.\n\n## Consequences\n\nOne database file to back up. Enable foreign keys on every connection. Keep database access outside the UI.\n\nA local database does not solve backup or accidental deletion. Those need explicit product behavior.\n\nRevisit only if the requirements change to simultaneous remote collaboration.'
        },
        {
          title: 'Deletion needs a product decision',
          body: 'Deleting a course could delete assignments, archive them, or be blocked while assignments remain. The database constraint should enforce the behavior the UI promises.\n\nFor now the feature is not exposed until the policy is chosen. Bring two examples to the next review: an empty course and a course with unfinished work.\n\n- [ ] Write the confirmation copy\n- [ ] Decide whether undo is required\n- [ ] Add a transaction for related changes'
        },
        {
          title: 'React \u2014 component boundaries',
          url: 'https://react.dev/learn',
          description:
            'Revisit state ownership before moving assignment filters into a shared component.'
        },
        {
          title: 'SQLite \u2014 referential integrity',
          url: 'https://www.sqlite.org/foreignkeys.html',
          description: 'Reference for course deletion and enabling foreign-key enforcement.'
        }
      ]
    },
    {
      name: 'Debugging notebook',
      icon: 'bulb',
      entries: [
        {
          title: 'The date moved back a day',
          body: 'Reproduction: enter a date-only deadline, serialize through a UTC timestamp, then display it in a timezone west of UTC. The visible calendar day shifts.\n\nThe input is a date, not an instant. Keep the YYYY-MM-DD value through storage and compare using a documented calendar-date rule.\n\n- [x] Identify the unwanted conversion\n- [ ] Add tests near month boundaries\n- [ ] Check daylight-saving transitions on reminder timestamps'
        },
        {
          title: 'Double submit creates two assignments',
          body: 'A fast double click issued two POST requests. Disabling the button while the request is pending helps the interaction, but the server still needs a policy for duplicate requests.\n\nStart by preserving the form while pending and preventing accidental resubmission. If retries are introduced, use an idempotency key and return the original result for that key.\n\nDo not deduplicate by title: two assignments can legitimately share a name.'
        },
        {
          title: 'Fetch failure checklist',
          body: 'Separate network failure, unsuccessful status, malformed JSON, and an unexpected payload shape. They need different debugging evidence even if the user-facing retry action is similar.\n\n```ts\nif (!response.ok) {\n  throw new Error(`HTTP ${response.status}`)\n}\n```\n\nLog the request ID and status, not the form contents. Validate the decoded payload before updating state.'
        },
        {
          title: 'Slow list \u2014 measure before memoising',
          body: 'The list felt slow with 2,000 tasks. Record a profile for typing in the filter, toggling a task, and switching courses.\n\nCheck whether all rows render on every keypress and whether sorting mutates shared state. Keep one derived filtered list rather than synchronizing a second copy.\n\n- [ ] Record a baseline\n- [ ] Identify the expensive interaction\n- [ ] Compare the same dataset after the change'
        },
        {
          title: 'MDN \u2014 Fetch response handling',
          url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch',
          description: 'Keep beside the request wrapper while implementing useful failure states.'
        },
        {
          title: 'Git \u2014 a branch I can experiment on',
          url: 'https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell',
          description: 'Practice a conflicting merge before trying it on the group repository.'
        }
      ]
    },
    {
      name: 'Workbench',
      icon: 'briefcase',
      entries: [
        {
          title: 'Release checklist',
          body: '- [x] Use a clean example database\n- [ ] Run setup from a fresh checkout\n- [ ] Test without a network connection\n- [ ] Check keyboard navigation\n- [ ] Verify export and restore\n- [ ] Ask someone else to follow the README\n\nKeep the first release honest about what is supported. A backup instruction that has not been tried is not finished.'
        },
        {
          title: 'Code review notes \u2014 smaller changes',
          body: 'The assignment form PR mixed validation, styling, and a database rename. Review was harder because the behavior changes were hidden among unrelated edits.\n\nNext time: finish the validation change with its error states, then send the independent layout update. Explain the trigger and the resulting behavior in the PR description.\n\nA small diff is useful when it represents one coherent decision.'
        },
        {
          title: 'Testing the upcoming view',
          body: 'Cases: no tasks, one task, equal deadlines, no deadline, overdue task, completed task.\n\nKeep time injectable so tests are repeatable. Compare dates using the same rule as the interface.\n\nA stable secondary sort prevents rows from jumping when two deadlines match. Confirm the product rule before hardcoding alphabetical order.'
        },
        {
          title: 'Monday build log',
          body: 'Finished the form validation and removed an unused loading flag. The remaining bug is the empty view flashing while a course changes.\n\nTomorrow: retain the previous view while loading, then replace it with the new results. Make pending state visible without resetting keyboard focus.\n\nStop after the regression test passes; the filter redesign is a separate task.'
        },
        {
          title: 'MIT \u2014 tools I use every day',
          url: 'https://missing.csail.mit.edu/',
          description:
            'Shell, debugging, and version-control material for improving the development workflow.'
        },
        {
          title: 'Python \u2014 a small import script',
          url: 'https://docs.python.org/3/tutorial/',
          description:
            'Reference for the one-off CSV import, especially files and exception handling.'
        }
      ]
    }
  ],
  researcher: [
    {
      name: 'Learning & recall',
      icon: 'book',
      entries: [
        {
          title: 'Research question \u2014 what helps recall?',
          body: 'I want to understand when retrieval practice is useful and how students actually fit it into a week of coursework. Separate the learning claim from the adoption problem.\n\n## Working questions\n\n- What is being recalled, and after how long?\n- What is the comparison activity?\n- How much feedback do students receive?\n\nDo not turn an interesting finding into universal advice. Keep the population and task beside the claim.'
        },
        {
          title: 'Reading note template',
          body: '## Source\n\nRecord author, title, date, and a stable link before writing a summary.\n\n## Claim\n\nWhat does the source actually argue?\n\n## Evidence\n\nWhat was observed, and what would count against the interpretation?\n\n## Limits\n\nPopulation, setting, measurement, and unanswered questions.\n\n## My next step\n\nOne question or a small experiment. A saved link is a starting point, not a completed reading.'
        },
        {
          title: 'Distinguish familiarity from recall',
          body: 'Recognizing a paragraph while rereading is different from producing the explanation with the source closed.\n\nFor my study diary, record the task: reread, answer a question, solve a problem, or explain from memory. Avoid reporting all four as \u201cstudying.\u201d\n\nThis is a proposed observation framework, not a result. Pilot it with one session before asking anyone else to use it.'
        },
        {
          title: 'Pilot diary \u2014 session prompts',
          body: 'Before the session: what are you trying to learn? After the session: what did you do, what was hard, and what can you now explain without looking?\n\nKeep the prompts short enough that the diary does not become the main activity. Let participants skip an entry.\n\n- [ ] Try the wording on my own session\n- [ ] Check whether the categories overlap\n- [ ] Rewrite ambiguous questions'
        },
        {
          title: 'MIT \u2014 mathematics course materials',
          url: 'https://ocw.mit.edu/courses/6-042j-mathematics-for-computer-science-spring-2015/',
          description:
            'A concrete example of a course with proofs and exercises; useful when defining different study tasks.'
        },
        {
          title: 'CS50 \u2014 course structure reference',
          url: 'https://cs50.harvard.edu/x/',
          description:
            'Look at the relationship between lectures, practice, and problem sets without assuming how students use them.'
        }
      ]
    },
    {
      name: 'Methods notebook',
      icon: 'flask',
      entries: [
        {
          title: 'Interview guide \u2014 walk through yesterday',
          body: 'Ask for a recent concrete session instead of a general opinion about study habits.\n\n1. What were you working on?\n2. What did you open first?\n3. When did you get stuck?\n4. How did you decide you were finished?\n\nFollow up on actions and examples. Avoid suggesting that flashcards or summaries are the expected answer.\n\nNo participant data is included in this demo library.'
        },
        {
          title: 'Observation vs interpretation',
          body: 'Observation: the participant reopened the same tutorial three times.\n\nPossible interpretations: the navigation was difficult, the explanation was useful, or they were switching between the tutorial and an exercise.\n\nDo not collapse these into \u201cthe student was confused.\u201d Keep the trace separate from the explanation, then ask a neutral follow-up.'
        },
        {
          title: 'Coding scheme \u2014 first draft',
          body: 'Initial categories: looking up syntax, tracing an example, solving independently, checking an answer, explaining aloud.\n\nAllow multiple codes when appropriate. Keep examples and boundary cases beside each definition.\n\nTwo people should try the same small sample and discuss disagreement before scaling up. Disagreement may reveal unclear categories rather than careless coding.'
        },
        {
          title: 'Sampling \u2014 who is missing?',
          body: 'Recruiting only from a programming club could overrepresent confident students who already enjoy self-directed learning.\n\nWrite down recruitment channels and who is likely to be absent. Include variation in experience and course load if the study question needs it.\n\nThis is a planning note. No sample has been recruited and no findings should be inferred from these examples.'
        },
        {
          title: 'Consent checklist for the pilot',
          body: '- [ ] Explain purpose in ordinary language\n- [ ] Say what will be recorded\n- [ ] Explain storage and access\n- [ ] Make participation voluntary\n- [ ] Explain withdrawal\n- [ ] Follow the institution\u2019s review process\n\nUse an approved process before collecting data. For the interface demo, keep all examples fictional and avoid names, recordings, and personal details.'
        },
        {
          title: 'Analysis memo \u2014 test my preferred explanation',
          body: 'I suspect people bookmark resources because deciding what to read feels like progress. That is a hypothesis, not a finding.\n\nLook for counterexamples: bookmarks used as precise reference tools, short-lived queues that get cleared, or deliberate project archives.\n\nWrite an alternative explanation before reading the next observation. Keep confidence proportional to the evidence.'
        }
      ]
    },
    {
      name: 'Synthesis & writing',
      icon: 'bookmark',
      entries: [
        {
          title: 'Evidence map \u2014 empty cells matter',
          body: '| Question | Evidence needed | Current status |\n| --- | --- | --- |\n| Does recall improve? | Defined outcome and comparison | Reading needed |\n| Is the habit sustainable? | Repeated observations | Not collected |\n| What gets in the way? | Concrete recent examples | Guide drafted |\n\nAn empty cell is a useful boundary. Do not fill it with a plausible story.'
        },
        {
          title: 'Draft outline \u2014 from question to limits',
          body: '1. Define the learning task\n2. Explain the study context\n3. Describe the method\n4. Present observations separately from interpretation\n5. Discuss limitations and alternatives\n6. State what remains unanswered\n\nWrite the methods section early. It exposes decisions that need to be settled before collecting anything.'
        },
        {
          title: 'Questions for the next meeting',
          body: '- Which outcome is realistic for a small pilot?\n- Is a diary appropriate for this question?\n- How much burden does each prompt add?\n- What would make us abandon the current categories?\n\nBring one completed self-pilot entry and one example that does not fit the coding scheme. Keep the meeting focused on decisions.'
        },
        {
          title: 'Reading queue \u2014 annotate before adding more',
          body: 'For each source, leave a one-sentence reason for saving it. After reading, replace that with a specific claim, a limit, and a question.\n\n- [ ] Finish the current methods chapter\n- [ ] Compare two definitions of retrieval practice\n- [ ] Remove duplicate bookmarks\n\nTen carefully annotated sources are more useful for this project than a hundred unexplained tabs.'
        },
        {
          title: 'Writing review \u2014 check the verbs',
          body: '\u201cProves\u201d is usually too strong for this draft. Be specific about what the evidence supports.\n\nReplace vague statements about \u201cusers\u201d with the population actually studied. Keep recommendations separate from observations.\n\nLast pass: check that every factual claim has an identifiable source and that summaries have not silently broadened the original scope.'
        },
        {
          title: 'MIT \u2014 learning the research tools',
          url: 'https://missing.csail.mit.edu/',
          description:
            'Shell and version-control material for reproducible notes and analysis scripts.'
        }
      ]
    }
  ],
  creative: [
    {
      name: 'Issue 03 \u2014 everyday objects',
      icon: 'palette',
      entries: [
        {
          title: 'Issue brief \u2014 things we overlook',
          body: 'A small newsletter about ordinary objects and the decisions behind them. Issue 03 follows a library card, a bus ticket, and a well-used notebook.\n\n## Direction\n\nSpecific stories, generous margins, and one strong image per article. Let the object provide the color instead of adding decoration everywhere.\n\n- [x] Choose the three objects\n- [ ] Confirm photography\n- [ ] Edit the opening paragraph\n- [ ] Print a rough proof'
        },
        {
          title: 'Opening paragraph \u2014 second attempt',
          body: 'The ticket was folded into the back of a notebook, long after the journey had stopped mattering. What stayed was the route number, the faded ink, and the small proof of having gone somewhere.\n\n## Edit notes\n\nKeep the physical details. Remove the sentence explaining what the reader should feel. Find the actual date before including it.\n\nThis is original sample copy for the demo, not a quotation.'
        },
        {
          title: 'Shot list \u2014 photograph what is there',
          body: 'Use my own objects and photographs. Soft window light, neutral surface, and enough room around the subject for cropping.\n\n- [ ] Library card, front and worn edge\n- [ ] Folded ticket beside the notebook\n- [ ] Notebook spine and handwritten index\n\nKeep names and identifying numbers out of the frame. Do not replace missing photographs with generated imagery. The draft can use an honest empty image slot until the shoot.'
        },
        {
          title: 'Article structure \u2014 one object, three details',
          body: 'Start with a physical observation. Follow with the object\u2019s practical role. Finish with one detail that changes how we see it.\n\nAvoid a history section unless there is a real source and a reason for it. A short piece should not pretend to be an exhaustive reference.\n\nTry a 350-word draft before designing the spread. The layout should respond to the story.'
        },
        {
          title: 'Issue checklist',
          body: '- [x] Working title and article order\n- [ ] Finish all three drafts\n- [ ] Shoot original photographs\n- [ ] Verify names, dates, and sources\n- [ ] Check image permissions\n- [ ] Read on a phone\n- [ ] Send a proof to the editor\n\nPublish only after the copy is stable enough that the design can be checked as a whole.'
        },
        {
          title: 'Accessibility \u2014 a reading reference',
          url: 'https://web.dev/learn/accessibility',
          description:
            'Review reading order, contrast, and image descriptions before the issue goes out.'
        }
      ]
    },
    {
      name: 'Type & layout',
      icon: 'book',
      entries: [
        {
          title: 'Type direction \u2014 let the reading lead',
          body: 'Keep navigation quiet and body text comfortable. Try IBM Plex Sans for longer pieces and system UI for labels.\n\nUse a small number of sizes. Distinguish headings through spacing and weight before adding another typeface.\n\n## Compare in context\n\n- A long headline\n- A paragraph with emphasis and a link\n- A caption beside a real image\n\nChoose after reading the same article in both versions, not from a single word specimen.'
        },
        {
          title: 'Spacing notes from the first proof',
          body: 'The article title and opening paragraph felt disconnected. Reduce the space between them while preserving a larger gap before the next section.\n\nThe caption belongs with the image. Keep the gap below the caption larger than the gap above it.\n\nPrint at actual size. A generous margin on a large screen can become an awkward column on a narrow one.'
        },
        {
          title: 'Mobile edition \u2014 what needs to change',
          body: 'Let the article become a single column. Keep the reading order intact when the side notes move underneath the text.\n\n- [ ] Test long headings\n- [ ] Check line length on a phone\n- [ ] Keep links distinguishable without color alone\n- [ ] Test at larger text sizes\n- [ ] Add meaningful image descriptions\n\nDo not shrink the whole desktop spread to fit a small screen.'
        },
        {
          title: 'Color notes \u2014 borrow from the objects',
          body: 'The ticket\u2019s faded orange can be an accent, but the article should still work without it. Keep the main text neutral and check actual text/background combinations.\n\nAvoid sampling a beautiful color and assuming it is readable at small sizes. Use the accent for a rule, a label, or a large title only after checking contrast.\n\nDecide on the final palette after the photographs exist.'
        },
        {
          title: 'CSS \u2014 layout reference',
          url: 'https://web.dev/learn/css',
          description: 'Reference for translating the editorial layout into a flexible web edition.'
        },
        {
          title: 'MDN \u2014 grid layout',
          url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout',
          description:
            'Save for the article index; compare a simple grid with the more complicated first sketch.'
        }
      ]
    },
    {
      name: 'Editorial desk',
      icon: 'briefcase',
      entries: [
        {
          title: 'Feedback \u2014 what changed after the read-through',
          body: 'The opening was too abstract until the ticket appeared. Move the object into the first sentence.\n\nThe notebook article has two endings; keep the one grounded in the handwritten index.\n\nThe index page needs clearer article titles, not bigger thumbnails.\n\nNext proof: read aloud, then ask someone unfamiliar with the project what each piece is about.'
        },
        {
          title: 'Permission log \u2014 do not guess',
          body: 'For each third-party image, record creator, source URL, license or written permission, required credit, and any restrictions.\n\nFor this issue, the preferred route is original photography. A saved reference image is not automatically cleared for publication.\n\nKeep reference material separate from the final export folder so it cannot slip into the issue accidentally.'
        },
        {
          title: 'Next issue \u2014 loose ideas',
          body: '- Objects repaired instead of replaced\n- Handwritten signs in the neighborhood\n- A collection of old keys\n- Tools that fit one person\u2019s hand\n\nThese are prompts, not a committed production plan. Pick one only after Issue 03 is published.\n\nSave concrete examples when I encounter them instead of collecting more vague mood words.'
        },
        {
          title: 'Export checklist \u2014 the last quiet pass',
          body: '- [ ] Correct article order\n- [ ] No temporary image slots\n- [ ] Captions and credits checked\n- [ ] Working links\n- [ ] Useful page title and description\n- [ ] Keyboard focus visible\n- [ ] File names make sense outside my computer\n\nOpen the exported result, not just the source. Check the first screen and the final paragraph on both phone and desktop.'
        },
        {
          title: 'A note to next month\u2019s me',
          body: 'Keep the draft that explains why a direction was chosen. The final files show the result, but the rejected title and the proof comments explain the work.\n\nArchive the issue with its sources and export checklist. Leave next month\u2019s workspace small enough that opening it feels like a beginning rather than a backlog.'
        },
        {
          title: 'MDN \u2014 web fundamentals',
          url: 'https://developer.mozilla.org/en-US/docs/Learn_web_development',
          description:
            'Keep the web edition understandable enough to maintain without a complicated publishing setup.'
        }
      ]
    }
  ]
}

export function personaLibrary(id: DemoPersonaId): LibraryDto {
  const createdAt = '2026-10-20T10:00:00.000Z'
  const collections: CollectionDto[] =
    id === 'student'
      ? studentCollections
      : folders[id].map((folder, index) => ({
          schemaVersion: 2,
          id: `${id}-folder-${index}`,
          name: folder.name,
          icon: folder.icon,
          createdAt,
          relativePath: folder.name,
          parentId: null
        }))
  const items: LibraryItemDto[] =
    id === 'student'
      ? studentItems
      : folders[id].flatMap((folder, folderIndex) =>
          folder.entries.map((entry, index): LibraryItemDto => {
            const collection = collections[folderIndex]
            const timestamp = new Date(
              Date.UTC(2026, 9, 20 - index, 12 - folderIndex)
            ).toISOString()
            const shared = {
              schemaVersion: 2 as const,
              id: `${id}-${folderIndex}-${index}`,
              title: entry.title,
              createdAt: timestamp,
              updatedAt: timestamp,
              location: { type: 'collection' as const, collectionId: collection.id },
              referencedAttachment: false as const
            }
            if (entry.url)
              return {
                ...shared,
                type: 'url',
                sourceUrl: entry.url,
                domain: new URL(entry.url).hostname,
                siteName: new URL(entry.url).hostname,
                description: entry.description ?? null,
                contentKind: 'webpage',
                metadataVersion: 1,
                hasFavicon: false,
                hasPreviewImage: false,
                metadataStatus: 'ready',
                metadataError: null,
                relativePath: `${collection.relativePath}/${entry.title}.url`
              }
            return {
              ...SAMPLE_NOTE,
              ...shared,
              body: `# ${entry.title}\n\n${entry.body}`,
              relativePath: `${collection.relativePath}/${entry.title}.md`
            }
          })
        )
  return {
    schemaVersion: 2,
    id: `demo-${id}`,
    name: 'My Library',
    path: `/demo/${id}`,
    createdAt,
    pinnedItemIds: items.slice(0, 1).map((item) => item.id),
    items,
    collections
  }
}
