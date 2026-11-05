/* eslint-disable @typescript-eslint/explicit-function-return-type */
;(() => {
  const key = 'kusu-site-theme'
  const root = document.documentElement
  let preference = readPreference()
  let button

  function readPreference() {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }

  function applyTheme() {
    const dark = preference === 'dark'
    root.dataset.siteTheme = dark ? 'dark' : 'light'
    button?.setAttribute('aria-pressed', String(dark))
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#181c19' : '#f7f7f4')
  }

  applyTheme()
  window.addEventListener('pageshow', () => {
    preference = readPreference() ?? preference
    applyTheme()
  })
  window.addEventListener('storage', (event) => {
    if (event.key !== key && event.key !== null) return
    preference = readPreference()
    applyTheme()
  })
  document.addEventListener('DOMContentLoaded', () => {
    button = document.querySelector('[data-site-theme-toggle]')
    applyTheme()
    if (!button) return
    button.hidden = false
    button.addEventListener('click', () => {
      preference = root.dataset.siteTheme === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(key, preference)
      } catch {
        // Keep the selection for this page when browser storage is unavailable.
      }
      applyTheme()
    })
  })
})()
