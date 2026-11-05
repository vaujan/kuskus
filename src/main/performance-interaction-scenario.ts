// Runs only against the isolated packaged benchmark fixture, through the rendered UI and IPC.
export const EXTENDED_BROWSING_SCENARIO = `
(async () => {
  let stage = 'initializing';
  const timings = [];
  const frame = () => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('No animation frame within 1 second')), 1000);
    requestAnimationFrame(() => { clearTimeout(timeout); resolve(); });
  });
  const visible = el => !!el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
  const find = selector => [...document.querySelectorAll(selector)].find(visible);
  const role = (name, text) => [...document.querySelectorAll('[role="' + name + '"]')].find(el => visible(el) && el.textContent.trim() === text);
  const until = async (predicate, label) => {
    const deadline = performance.now() + 15000;
    while (!predicate()) {
      if (performance.now() > deadline) throw new Error('Timed out: ' + label);
      await frame();
    }
  };
  const settle = async () => { await frame(); await frame(); };
  const measure = async (name, action, predicate) => {
    stage = name;
    const start = performance.now();
    await action();
    if (predicate) { await until(predicate, name); await frame(); }
    timings.push({ name, milliseconds: performance.now() - start });
  };
  const checked = response => { if (!response.ok) throw new Error(JSON.stringify(response)); return response.data; };
  const root = () => find('[data-virtual-list]');
  const primary = () => root()?.querySelector('[data-slot="item-card-primary-action"]');
  const nav = name => [...document.querySelectorAll('[data-slot="sidebar-menu-button"]')].find(el => visible(el) && el.textContent.trim() === name);
  const chooseLayout = async (label, mode) => {
    stage = 'menu: ' + label;
    find('[aria-label="Show application menu"]')?.click();
    await until(() => role('menuitem', 'View'), 'View menu');
    role('menuitem', 'View').click();
    await until(() => role('menuitemradio', label), label + ' menu item');
    await measure('layout-' + mode, () => role('menuitemradio', label).click(), () => root()?.dataset.virtualList === mode);
  };
  const setSearch = text => {
    const input = find('input[aria-label="Search"]');
    if (!input) throw new Error('Search input unavailable');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const escape = () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  try {
    await measure('destination-all', () => nav('All Items').click(), () => find('[title="All Items"]'));
    await chooseLayout('Grid', 'grid');
    await chooseLayout('Masonry', 'masonry');
    const overview = checked(await window.kusu.getOverview());
    if (overview.status !== 'ready') throw new Error('Fixture unavailable');
    const items = overview.library.items;
    const note = items.find(item => item.type === 'note');
    const folder = overview.library.collections[0];
    if (folder) {
      stage = 'folder navigation';
      const button = [...document.querySelectorAll('[data-slot="sidebar-menu-button"]')].find(el => visible(el) && el.textContent.includes(folder.name));
      if (!button) throw new Error('Missing fixture folder');
      await measure('destination-folder', () => button.click(), () => find('[title="' + folder.name + '"]'));
      await measure('destination-all-return', () => nav('All Items').click(), () => find('[title="All Items"]'));
    }
    for (const query of ['search', 'searchable', note.title]) {
      await measure('search-results', () => setSearch(query), () => find('input[aria-label="Search"]')?.getAttribute('aria-busy') === 'false' && !!primary());
    }
    setSearch('no-match-before-clear');
    setSearch('');
    await until(() => root()?.querySelectorAll('[data-card-key]').length > 1, 'clear search');
    escape();
    await settle();
    stage = 'open note';
    setSearch(note.title);
    await until(() => find('input[aria-label="Search"]')?.getAttribute('aria-busy') === 'false' && !!primary(), 'note search');
    await measure('open-note-cold', () => primary().click(), () => !!find('[data-detail-pane]'));
    // Show the complete rail before testing its endpoints.
    find('input[aria-label="Search"]') && setSearch('');
    await settle();
    let maxFocusMounted = 0;
    const endpoint = async key => {
      const button = primary();
      button.focus();
      await measure('focus-' + key, () => button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })), () => {
        const focused = document.activeElement?.closest('[data-card-index]');
        const total = Number(root()?.dataset.itemCount);
        return focused && Number(focused.dataset.cardIndex) === (key === 'End' ? total - 1 : 0);
      });
      maxFocusMounted = Math.max(maxFocusMounted, root().querySelectorAll('[data-card-key]').length);
      if (maxFocusMounted > 150) throw new Error('Focus mounted more than 150 rows');
    };
    for (let index = 0; index < 3; index++) {
      const button = [...root().querySelectorAll('[data-slot="item-card-primary-action"]')].find(el => el.closest('[data-item-id]').dataset.active !== 'true');
      const id = button.closest('[data-item-id]').dataset.itemId;
      const item = items.find(entry => entry.id === id);
      await measure('open-note-warm', () => button.click(), () => find('[data-detail-surface]')?.getAttribute('aria-label') === 'Item details for ' + item.title);
    }
    await endpoint('End'); await endpoint('Home');
    stage = 'focus density';
    find('[aria-label^="Sort and filter "]').click();
    await until(() => role('menuitemradio', 'Index'), 'Index density');
    role('menuitemradio', 'Index').click();
    await until(() => root()?.dataset.virtualList === 'list', 'Index rail');
    await endpoint('End'); await endpoint('Home');
    await chooseLayout('Masonry', 'masonry');
    // Exercise media detail through UI search, not only the service's DTO path.
    const media = ['image', 'url', 'file'].map(type => items.find(item => item.type === type)).filter(Boolean);
    for (const item of media) {
      stage = 'media search: ' + item.type;
      setSearch(item.title);
      await until(() => find('input[aria-label="Search"]')?.getAttribute('aria-busy') === 'false' && !!primary(), 'media result');
      await measure('open-' + item.type, () => primary().click(), () => !!find('[data-detail-pane]'));
      if (item.type === 'image') await measure('image-ready', () => {}, () => [...document.querySelectorAll('[data-detail-pane] img')].some(el => el.complete && el.naturalWidth > 0));
      if (item.type === 'file') await measure('pdf-ready', () => {}, () => !!find('[aria-label="PDF pages"]'));
      await chooseLayout('Masonry', 'masonry');
    }
    setSearch(''); await settle(); escape(); await settle();
    stage = 'bulk selection';
    const targets = [...root().querySelectorAll('[data-slot="item-card-primary-action"]')].slice(0, 3);
    const ids = targets.map(el => el.closest('[data-item-id]').dataset.itemId);
    for (const button of targets) button.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    await settle();
    const actions = targets[0].closest('[data-item-id]').querySelector('[aria-label^="Actions for "]');
    actions.click();
    await until(() => role('menuitem', 'Archive'), 'Archive action');
    await measure('bulk-archive-ui', () => role('menuitem', 'Archive').click(), () => ids.every(id => !root()?.querySelector('[data-item-id="' + id + '"]')));
    const archived = checked(await window.kusu.getOverview());
    if (archived.status !== 'ready') throw new Error('Archive overview: ' + JSON.stringify(archived));
    if (!ids.every(id => archived.library.items.find(item => item.id === id)?.location.type === 'archive')) throw new Error('Bulk archive did not persist');
    await measure('bulk-restore-ipc', async () => checked(await window.kusu.unarchiveItems({ itemIds: ids })));
    const detail = checked(await window.kusu.getItemDetail(note.id));
    await measure('edit-note-ipc', async () => {
      const saved = checked(await window.kusu.updateNote({ itemId: note.id, markdown: detail.body + '\\n\\nBenchmark edit.', expectedMarkdown: detail.body }));
      if (!saved.body.endsWith('Benchmark edit.')) throw new Error('Note edit was not saved');
    });
    if (folder) await measure('bulk-move-ipc', async () => {
      const moved = checked(await window.kusu.moveItems({ itemIds: ids, destination: { type: 'collection', collectionId: folder.id } }));
      if (!ids.every(id => moved.items.find(item => item.id === id)?.location.collectionId === folder.id)) throw new Error('Move did not persist');
    });
    if (folder) await measure('bulk-move-back-ipc', async () => checked(await window.kusu.moveItems({ itemIds: ids, destination: { type: 'inbox' } })));
    return { timings, maxFocusMounted, mediaTypes: media.map(item => item.type) };
  } catch (error) { throw new Error(stage + ': ' + String(error)); }
})()
`
