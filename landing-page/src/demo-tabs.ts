import { demoPersonas, DEMO_READY_MESSAGE, DEMO_SELECT_MESSAGE } from './demo-personas'

const tablist = document.querySelector<HTMLElement>('[data-demo-tabs]')!
const frame = document.querySelector<HTMLIFrameElement>('#persona-preview')!
const panel = document.querySelector<HTMLElement>('#persona-panel')!
let selectedIndex = 0

const iconPaths = {
  book: '<path d="M12 7v14m0-14C8 4 5 4 2 5v15c3-1 6-1 10 1 4-2 7-2 10-1V5c-3-1-6-1-10 2Z"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  pen: '<path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-3 3 5 5"/>'
}

function updatePreview(): void {
  frame.contentWindow?.postMessage(
    { type: DEMO_SELECT_MESSAGE, persona: demoPersonas[selectedIndex].id },
    window.location.origin
  )
}

function selectPersona(index: number, focus = false): void {
  selectedIndex = index
  const persona = demoPersonas[index]
  const tabs = Array.from(tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
  for (const [tabIndex, tab] of tabs.entries()) {
    tab.setAttribute('aria-selected', String(tabIndex === index))
    tab.tabIndex = tabIndex === index ? 0 : -1
  }
  panel.setAttribute('aria-labelledby', `persona-tab-${persona.id}`)
  panel.dataset.persona = persona.id
  updatePreview()
  if (focus) tabs[index].focus()
}

for (const [index, persona] of demoPersonas.entries()) {
  const tab = document.createElement('button')
  tab.type = 'button'
  tab.id = `persona-tab-${persona.id}`
  tab.setAttribute('role', 'tab')
  tab.setAttribute('aria-controls', 'persona-panel')
  tab.setAttribute('aria-labelledby', `persona-label-${persona.id}`)
  tab.setAttribute('aria-describedby', `persona-description-${persona.id}`)

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  icon.setAttribute('viewBox', '0 0 24 24')
  icon.setAttribute('fill', 'none')
  icon.setAttribute('stroke', 'currentColor')
  icon.setAttribute('stroke-width', '1.5')
  icon.setAttribute('stroke-linecap', 'round')
  icon.setAttribute('stroke-linejoin', 'round')
  icon.setAttribute('aria-hidden', 'true')
  icon.innerHTML = iconPaths[persona.icon]

  const copy = document.createElement('span')
  copy.className = 'demo-tab-copy'
  const label = document.createElement('span')
  label.className = 'demo-tab-label'
  label.id = `persona-label-${persona.id}`
  label.textContent = persona.label
  const description = document.createElement('span')
  description.className = 'demo-tab-description'
  description.id = `persona-description-${persona.id}`
  description.textContent = persona.description
  copy.append(label, description)
  tab.append(icon, copy)

  tab.addEventListener('click', () => selectPersona(index))
  tab.addEventListener('keydown', (event) => {
    let next: number
    if (event.key === 'ArrowRight') next = (index + 1) % demoPersonas.length
    else if (event.key === 'ArrowLeft')
      next = (index + demoPersonas.length - 1) % demoPersonas.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = demoPersonas.length - 1
    else return
    event.preventDefault()
    selectPersona(next, true)
  })
  tablist.append(tab)
}

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return
  if (event.data?.type === DEMO_READY_MESSAGE) updatePreview()
})
selectPersona(0)
