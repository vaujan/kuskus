/* eslint-disable @typescript-eslint/no-require-imports */
const { readFileSync, writeFileSync } = require('node:fs')
const { resolve } = require('node:path')

const source = resolve('node_modules/katex/dist/katex.min.css')
const target = resolve('src/renderer/src/assets/katex-woff2.css')

const css = readFileSync(source, 'utf8')

// Vite resolves url() relative to the importing CSS file. The generated file
// lives in src/renderer/src/assets, so point the KaTeX fonts at the package
// copy via a relative crawl, keeping only the woff2 variant Electron will use.
const RELATIVE = '../../../../node_modules/katex/dist/fonts'

const trimmed = css
  .split('@font-face{')
  .map((segment, index) => {
    if (index === 0 || !segment.includes('src:url(')) return segment
    const closingBrace = segment.indexOf('}')
    const rule = segment.slice(0, closingBrace)
    const rest = segment.slice(closingBrace)
    const woff2Only = rule
      .split(/,(?=url\()/)
      .filter((part) => part.includes('.woff2'))
      .join(',')
    return woff2Only.replace(/url\(fonts\//g, `url(${RELATIVE}/`) + rest
  })
  .join('@font-face{')

writeFileSync(target, trimmed)
console.log(`Wrote ${trimmed.length} bytes to ${target}`)