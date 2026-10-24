const languageSelect = document.querySelector<HTMLSelectElement>('[data-language-select]')

languageSelect?.addEventListener('change', () => {
  const destination = new URL(languageSelect.value, window.location.href)
  destination.hash = window.location.hash
  window.location.assign(destination.href)
})

// Restore the displayed language when returning through browser history.
window.addEventListener('pageshow', () => {
  if (languageSelect) {
    languageSelect.value =
      languageSelect.querySelector<HTMLOptionElement>('option[selected]')!.value
  }
})
