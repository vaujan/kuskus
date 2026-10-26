# Writing a pull request

A PR should help someone understand why the change matters and decide whether it works. Keep it as short as the change allows. Plain language and imperfect English are welcome.

## Start with your reason

Use a title that names the result, such as “Keep note edits when switching folders.” Avoid titles like “Enhance the user experience.”

Write the opening section yourself. Describe what you ran into, what should happen instead, and why you chose this fix. For maintenance work, explain who benefits, even if nothing changes on screen. A sentence or two is enough for a small fix.

For example, a contributor might write:

> I kept losing my place when switching between reference folders. This keeps the selected note open when it still belongs to the new folder. I chose this behavior so browsing doesn’t interrupt reading.

That is an illustration, not a statement about a tested Kuskus fix. Use your own experience and reasoning; don’t invent a story to fill the template.

## Explain the implementation and checks

Follow your reason with the technical details a reviewer needs. Explain the approach or tradeoff when it isn’t obvious from the diff. AI can draft this section, but you must verify it against the actual changes.

List the checks you ran and what happened. Separate automated checks from hands-on testing. Include screenshots for visible changes and call out anything untested or unfinished. “Not run: no Windows machine available” is useful information. “All tests pass” without running them is false.

Link the issue if there is one. Small changes don’t need a file-by-file summary or an essay.

## Disclose AI use honestly

Every PR must include one of these: no AI used, or the tools and models used with a short account of their roles. This includes help with reviews, tests, documentation, and the PR text, not only generated code.

Use the exact model label shown by the tool or session metadata, such as GPT-6.1. Check that metadata before drafting the disclosure. A tool name alone doesn’t identify its model; do not omit an available model label or replace it with “unknown.” If you used several models, list each model and its role. Only when no model label is available, write “model not exposed” or “automatic selection; model unknown.” Don’t infer the model from the output or ask a chatbot to identify itself as proof.

A disclosure can look like this:

```text
Tool: [editor or service]
Model: [label shown in the tool, or “model not exposed”]
Helped with: drafting the regression test and organizing the technical summary
My review: read the diff, reproduced the bug, and ran the checks listed above
```

Replace the placeholders with what happened. “My review” describes your own work; it isn’t a claim that using AI makes a change safe. Don’t include private conversations or prompt logs. Share a brief prompt only if it helps explain a decision and contains no sensitive information.

## Keep the conversation useful

When updating a PR, explain what you changed and which feedback it addresses. If a check still fails, say so. If you disagree with a suggestion, explain the tradeoff. The contributor remains responsible for the code and the accuracy of the description, regardless of the tools used.
