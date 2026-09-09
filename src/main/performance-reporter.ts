import { app, type BrowserWindow } from 'electron'
import {
  flushPerformanceLog,
  performanceLoggingEnabled,
  writePerformanceEvent
} from './performance-log'
import type { LibraryService } from './library/library-service'

const typingEnabled = process.env.KUSKUS_PERFORMANCE_TYPING === '1'

const TYPING_INSTRUMENTATION = `
  (() => {
    const state = (window.__kuskusTyping = { keyLatencies: [], droppedFrames: 0, longTasks: [], rafTicks: 0, pendingKeyTimes: [] });
    let lastFrame = performance.now();
    const frame = () => {
      const now = performance.now();
      state.rafTicks += 1;
      if (now - lastFrame > 25) state.droppedFrames += 1;
      lastFrame = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    window.addEventListener('keydown', () => {
      state.pendingKeyTimes.push(performance.now());
      requestAnimationFrame(() => {
        if (state.pendingKeyTimes.length > 0) {
          const paintedAt = performance.now();
          for (const keyAt of state.pendingKeyTimes) state.keyLatencies.push(paintedAt - keyAt);
          state.pendingKeyTimes.length = 0;
        }
      });
    });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) state.longTasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: true });
  })();
  window.__kuskusLongTasks = window.__kuskusTyping.longTasks;
`

const TYPING_RESET = `(() => { const s = window.__kuskusTyping; if (s) { s.keyLatencies = []; s.droppedFrames = 0; s.longTasks = []; s.pendingKeyTimes.length = 0; } return !!s })()`

const TYPING_READ = `(() => { const s = window.__kuskusTyping; return s ? { keyLatencies: s.keyLatencies, droppedFrames: s.droppedFrames, longTasks: s.longTasks, rafTicks: s.rafTicks } : null })()`

const FOCUS_SEARCH = `(() => {
  const input = document.querySelector('input[aria-label="Search the entire library"]');
  if (!input) return false;
  input.focus();
  return true;
})()`

const OPEN_SEARCH = `(() => {
  const trigger = document.querySelector('button[aria-label="Search the entire library"]');
  if (!trigger) return false;
  trigger.click();
  return true;
})()`

const CLEAR_SEARCH = `(() => {
  const input = document.querySelector('input[aria-label="Search the entire library"]');
  if (!input) return;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '');
  input.dispatchEvent(new Event('input', { bubbles: true }));
})()`

const OPEN_FIRST_NOTE = `(() => {
  const card = document.querySelector('[aria-label^="Open note "]');
  if (!card) return false;
  card.click();
  return true;
})()`

const FOCUS_EDITOR = `(() => {
  const editor =
    document.querySelector('[aria-label="Markdown editor"]') ??
    document.querySelector('[aria-label="Rich Markdown editor"]');
  if (!editor) return false;
  editor.focus();
  return true;
})()`

const EDITOR_PRESENT = `!!(
  document.querySelector('[aria-label="Markdown editor"]') ??
  document.querySelector('[aria-label="Rich Markdown editor"]')
)`

const DETAIL_OPEN = `!!document.querySelector('[aria-label^="Item details for"]')`

const SWITCH_TO_MARKDOWN = `(() => {
  const trigger = document.querySelector('[aria-label^="Note mode:"]');
  if (!trigger) return false;
  trigger.click();
  return true;
})()`

const CLICK_MARKDOWN_ITEM = `(() => {
  const item = [...document.querySelectorAll('[role="menuitemradio"]')].find((el) =>
    el.textContent.includes('Markdown')
  );
  if (!item) return false;
  item.click();
  return true;
})()`

const WAIT_STABLE = `new Promise((resolve) => {
  let stable = 0;
  let last = performance.now();
  const step = () => {
    const now = performance.now();
    if (now - last < 50) stable += 1;
    else stable = 0;
    last = now;
    if (stable >= 3) resolve(true);
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
})`

export function startPerformanceReporter(
  window: BrowserWindow,
  libraryService: LibraryService
): void {
  if (!app.isPackaged || !performanceLoggingEnabled()) return

  const wait = (milliseconds: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, milliseconds))

  const sendKey = (
    window: BrowserWindow,
    type: 'keyDown' | 'keyUp' | 'char',
    char: string
  ): void => {
    window.webContents.sendInputEvent({ type, keyCode: char })
  }

  const typeKey = async (char: string): Promise<void> => {
    sendKey(window, 'keyDown', char)
    sendKey(window, 'char', char)
    sendKey(window, 'keyUp', char)
  }

  const waitStable = async (): Promise<void> => {
    await Promise.race([
      window.webContents.executeJavaScript(WAIT_STABLE).then(() => undefined),
      wait(15_000).then(() => undefined)
    ])
    await wait(1_000)
  }

  const sampleMemory = async (checkpoint: string): Promise<void> => {
    const processes = app.getAppMetrics().map((metric) => ({
      type: metric.type,
      pid: metric.pid,
      workingSetKb: metric.memory.workingSetSize,
      peakWorkingSetKb: metric.memory.peakWorkingSetSize
    }))
    writePerformanceEvent(checkpoint, {
      processes,
      totalWorkingSetKb: processes.reduce((total, metric) => total + metric.workingSetKb, 0),
      main: await process.getProcessMemoryInfo()
    })
  }

  const waitFor = async (
    check: () => Promise<boolean>,
    intervalMs: number,
    timeoutMs: number
  ): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (await check()) return true
      await wait(intervalMs)
    }
    return false
  }

  const scenarioState = (): Promise<unknown> =>
    window.webContents
      .executeJavaScript(TYPING_READ)
      .then((data: unknown) => data)
      .catch(() => null)

  let scenarioDone: Promise<void> = Promise.resolve()

  const runTypingScenario = async (): Promise<void> => {
    if (!typingEnabled) return
    try {
      await window.webContents.executeJavaScript(TYPING_INSTRUMENTATION)
    } catch {
      return
    }

    const empty = {
      keyLatencies: [] as number[],
      droppedFrames: 0,
      longTasks: [] as number[],
      rafTicks: 0
    }
    const summarize = (data: unknown): typeof empty => (data as typeof empty | null) ?? empty

    const ready = await waitFor(
      () =>
        window.webContents
          .executeJavaScript(
            `!!document.querySelector('button[aria-label="Search the entire library"]')`
          )
          .catch(() => false),
      250,
      60_000
    )

    const scansBefore = libraryService.getPerformanceVaultScanCount()

    let search: typeof empty = empty
    let note: typeof empty = empty
    let noteScansBefore: number | null = null
    if (ready) {
      const searchOpened = await window.webContents.executeJavaScript(OPEN_SEARCH)
      const searchReady =
        searchOpened &&
        (await waitFor(
          () =>
            window.webContents
              .executeJavaScript(
                `!!document.querySelector('input[aria-label="Search the entire library"]')`
              )
              .catch(() => false),
          100,
          5_000
        ))
      const searchFocused =
        searchReady && (await window.webContents.executeJavaScript(FOCUS_SEARCH))
      if (searchFocused) {
        await waitStable()
        await typeKey('a')
        await waitStable()
        await window.webContents.executeJavaScript(TYPING_RESET)
        for (const char of 'alpha') {
          await typeKey(char)
          await wait(25)
        }
        await wait(250)
        await window.webContents.executeJavaScript(CLEAR_SEARCH)
        await wait(250)
        sendKey(window, 'keyDown', 'Escape')
        sendKey(window, 'keyUp', 'Escape')
        await wait(150)
      }
      search = summarize(await scenarioState())

      await window.webContents.executeJavaScript(TYPING_RESET)
      const noteOpened = await window.webContents.executeJavaScript(OPEN_FIRST_NOTE)
      if (noteOpened) {
        const dialogReady = await waitFor(
          () => window.webContents.executeJavaScript(DETAIL_OPEN).catch(() => false),
          250,
          30_000
        )
        let switched = false
        if (dialogReady) {
          switched = await window.webContents.executeJavaScript(SWITCH_TO_MARKDOWN)
          if (switched) {
            await wait(200)
            switched = await window.webContents.executeJavaScript(CLICK_MARKDOWN_ITEM)
          }
        }
        const editorReady =
          switched &&
          (await waitFor(
            () => window.webContents.executeJavaScript(EDITOR_PRESENT).catch(() => false),
            250,
            30_000
          ))
        if (editorReady) {
          await window.webContents.executeJavaScript(FOCUS_EDITOR)
          await waitStable()
          await typeKey('0')
          await waitStable()
          await window.webContents.executeJavaScript(TYPING_RESET)
          noteScansBefore = libraryService.getPerformanceVaultScanCount()
          for (let index = 0; index < 10; index += 1) {
            await typeKey(String(index % 10))
            await wait(25)
          }
        }
        await wait(1_500)
      }
      note = summarize(await scenarioState())
      writePerformanceEvent('typing', {
        completed: ready,
        search,
        note,
        vaultScans: libraryService.getPerformanceVaultScanCount() - scansBefore,
        autosaveScans:
          libraryService.getPerformanceVaultScanCount() - (noteScansBefore ?? scansBefore)
      })
    }
  }

  window.webContents.once('did-finish-load', () => {
    void window.webContents.executeJavaScript(
      typingEnabled
        ? TYPING_INSTRUMENTATION
        : `
          window.__kuskusLongTasks = [];
          new PerformanceObserver((list) => {
            window.__kuskusLongTasks.push(...list.getEntries().map((entry) => entry.duration));
          }).observe({ type: 'longtask', buffered: true });
        `
    )

    if (typingEnabled) {
      scenarioDone = runTypingScenario().catch(() => undefined)
    }

    let firstCardWritten = false
    const poll = setInterval(() => {
      if (window.isDestroyed()) return
      void window.webContents
        .executeJavaScript(
          `performance.getEntriesByName('kuskus:renderer-entry-to-first-card').at(-1)?.duration ?? null`
        )
        .then(async (duration: number | null) => {
          if (duration === null || firstCardWritten) return
          firstCardWritten = true
          clearInterval(poll)
          writePerformanceEvent('first-card', { milliseconds: duration })
          await sampleMemory('first-card-memory')
        })
    }, 100)
    poll.unref()
  })

  void sampleMemory('ready-memory')
  const duration = Math.max(1_000, Number(process.env.KUSKUS_PERFORMANCE_DURATION_MS) || 10_000)
  const finish = setTimeout(() => {
    if (window.isDestroyed()) return app.quit()
    void scenarioDone
      .then(() =>
        window.webContents.executeJavaScript(
          `({
        url: location.href,
        text: document.body.innerText.slice(0, 500),
        measures: performance.getEntriesByType('measure').map(({ name, duration }) => ({ name, duration })),
        longTasks: window.__kuskusLongTasks ?? []
      })`
        )
      )
      .then(async (renderer: unknown) => {
        writePerformanceEvent('renderer', renderer)
        await sampleMemory('settled-memory')
        await flushPerformanceLog()
        app.quit()
      })
      .catch(async (error: unknown) => {
        writePerformanceEvent('error', error instanceof Error ? error.message : String(error))
        await flushPerformanceLog()
        app.quit()
      })
  }, duration)
  finish.unref()
}
