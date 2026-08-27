if (import.meta.env.DEV) {
  await import('./dev-tools')
}

await import('./main')
