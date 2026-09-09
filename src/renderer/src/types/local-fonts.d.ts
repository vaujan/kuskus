interface LocalFontData {
  readonly family: string
  readonly fullName: string
  readonly postscriptName: string
  readonly style: string
}

interface Window {
  queryLocalFonts?: () => Promise<readonly LocalFontData[]>
}
