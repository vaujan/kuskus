const repository = 'https://github.com/vaujan/kuskus'
const indonesian = document.documentElement.lang === 'id'
const copy = indonesian
  ? {
      empty: 'Belum ada berkas untuk platform ini pada rilis terbaru.',
      unpublished: 'Penginstal belum dipublikasikan. Coba demo sambil menunggu rilis pertama.',
      error: 'Daftar unduhan tidak dapat dimuat. Periksa berkas langsung di GitHub Releases.',
      release: 'Rilis terbaru:',
      source: 'Kode sumber',
      download: 'Unduh',
      preview:
        'Pratinjau eksperimental · Windows belum ditandatangani; macOS memakai penandatanganan ad-hoc tanpa notarisasi. Pembaruan dipasang manual.'
    }
  : {
      empty: 'No files for this platform in the latest release yet.',
      unpublished:
        'Installers have not been published yet. Try the demo while we prepare the first release.',
      error: 'Downloads could not be loaded. Check the files directly on GitHub Releases.',
      release: 'Latest release:',
      source: 'Source code',
      download: 'Download',
      preview:
        'Experimental preview · Windows is unsigned; macOS uses ad-hoc signing without notarization. Updates are installed manually.'
    }

interface ReleaseAsset {
  name: string
  size: number
  browser_download_url: string
}

interface Release {
  tag_name: string
  assets: ReleaseAsset[]
  prerelease: boolean
  draft: boolean
}

function addDownload(container: Element, label: string, url: string, primary = false): void {
  const link = document.createElement('a')
  link.className = primary ? 'primary-action' : 'secondary-action'
  link.href = url
  link.textContent = label
  container.append(link)
}

async function loadDownloads(): Promise<void> {
  const status = document.querySelector<HTMLElement>('[data-download-status]')!
  try {
    const response = await fetch(
      'https://api.github.com/repos/vaujan/kuskus/releases?per_page=10',
      {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(10000)
      }
    )
    if (response.status === 404) {
      status.textContent = copy.unpublished
      return
    }
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
    const releases: Release[] = await response.json()
    const release = releases.find((candidate) => !candidate.draft)
    if (!release) {
      status.textContent = copy.unpublished
      return
    }
    const releaseUrl = `${repository}/releases/tag/${encodeURIComponent(release.tag_name)}`
    status.textContent = `${copy.release} ${release.tag_name}${release.prerelease ? ` · ${copy.preview}` : ''}`
    const formats = {
      windows: /-setup\.exe$/i,
      macos: /\.dmg$/i,
      linux: /\.AppImage$/i
    }
    for (const [platform, extension] of Object.entries(formats)) {
      const container = document.querySelector(`[data-download-platform="${platform}"]`)!
      const assets = release.assets.filter((asset) => extension.test(asset.name))
      container.replaceChildren()
      for (const asset of assets) {
        // Only link to assets hosted by this repository's release service.
        if (!asset.browser_download_url.startsWith(`${repository}/releases/download/`)) continue
        const size = new Intl.NumberFormat(indonesian ? 'id-ID' : 'en-US', {
          maximumFractionDigits: 1
        }).format(asset.size / 1024 / 1024)
        addDownload(
          container,
          `${copy.download} ${asset.name} · ${size} MB ↓`,
          asset.browser_download_url,
          true
        )
      }
      if (!container.childElementCount) container.textContent = copy.empty
    }
    const files = document.querySelector('[data-release-files]')!
    addDownload(
      files,
      `${copy.source} (.zip) ↓`,
      `${repository}/archive/refs/tags/${encodeURIComponent(release.tag_name)}.zip`
    )
    addDownload(
      files,
      `${copy.source} (.tar.gz) ↓`,
      `${repository}/archive/refs/tags/${encodeURIComponent(release.tag_name)}.tar.gz`
    )
    addDownload(
      files,
      indonesian
        ? 'Semua berkas, checksum, dan catatan rilis ↗'
        : 'All files, checksums, and release notes ↗',
      releaseUrl
    )
  } catch {
    status.textContent = copy.error
  }
}

void loadDownloads()
