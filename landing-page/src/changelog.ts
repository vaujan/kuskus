import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'

import type releaseNotes from '../../releases/notes.json'

const notesPath = new URL('../../releases/notes.json', import.meta.url)
const formatDate = new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' })

function escapeText(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function renderNote(text: string): string {
  return escapeText(text).replace(/`([^`]+)`/g, '<code>$1</code>')
}

export function changelog(): Plugin {
  return {
    name: 'kusu-changelog',
    transformIndexHtml(html) {
      if (!html.includes('<!-- release-history -->')) return

      const { releases } = JSON.parse(readFileSync(notesPath, 'utf8')) as typeof releaseNotes
      const history = releases.map(({ version, date, notes }) => {
        const id = `v${escapeText(version)}`
        const groups = Object.entries(notes.changes).map(
          ([category, entries]) => `
            <h3>${escapeText(category)}</h3>
            <ul>${entries.map((entry: string) => `<li>${renderNote(entry)}</li>`).join('')}</ul>`
        )
        return `
          <article class="changelog-entry" aria-labelledby="${id}">
            <header>
              <h2 id="${id}"><a href="#${id}">${id}</a></h2>
              <time datetime="${date}">${formatDate.format(new Date(date))}</time>
            </header>
            <div>
              ${'summary' in notes && notes.summary ? `<p>${renderNote(notes.summary)}</p>` : ''}
              ${groups.join('')}
            </div>
          </article>`
      })

      return html.replace('<!-- release-history -->', () => history.join(''))
    }
  }
}
