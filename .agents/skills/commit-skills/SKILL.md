---
name: commit-skills
description: Write short, clear Git commit messages from staged changes or a supplied diff. Use when asked to create, suggest, revise, or validate a commit message, including during a commit workflow.
---

# Write Git Commit Messages

Inspect the staged changes or supplied diff before writing the message. Summarize the change itself, not the act of editing files.

Follow these rules:

- Return only the commit message when the user asks for a message.
- Use an imperative, capitalized subject without ending punctuation.
- Aim for 50 characters or fewer in the subject.
- Omit the body when the subject fully explains the change.
- Add a concise body only when it provides useful context such as motivation, behavior, or an important tradeoff.
- Separate the subject and body with a blank line.
- Wrap body lines at 72 characters.
- Do not repeat the subject in the body.
- Do not include raw diff output or meta-commentary.

When committing changes directly, apply the same rules to each commit and keep each commit focused on one coherent concern.
