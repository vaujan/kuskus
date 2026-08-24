const assert = require('node:assert/strict')
const test = require('node:test')
require('./helpers/install-ts-require.cjs')()

const {
  buildFolderSubtreeCounts,
  buildFolderTree,
  flattenFolderTree,
  getFolderAncestorIds,
  getFolderSubtreeIds,
  getVisibleFolderIds,
  sanitizeCollapsedFolderIds
} = require('../src/renderer/src/features/collections/folder-tree.ts')

test('builds a sorted folder tree and keeps invalid ancestry visible at the root', () => {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const collection = (id, name, parentId = null) => ({
    schemaVersion: 2,
    id,
    name,
    icon: 'folder',
    createdAt: '2026-07-29T00:00:00.000Z',
    relativePath: parentId ? `Parent/${name}` : name,
    parentId
  })
  const folders = [
    collection('root-b', 'Writing'),
    collection('child-b', 'Zebra', 'root-a'),
    collection('orphan', 'Orphan', 'missing'),
    collection('root-a', 'Projects'),
    collection('child-a', 'Alpha', 'root-a'),
    collection('grandchild', 'Research', 'child-a'),
    collection('cycle-a', 'Cycle A', 'cycle-b'),
    collection('cycle-b', 'Cycle B', 'cycle-a')
  ]

  const tree = buildFolderTree(folders)
  assert.deepEqual(
    tree.map((node) => node.folder.name),
    ['Cycle A', 'Cycle B', 'Orphan', 'Projects', 'Writing']
  )
  const projects = tree.find((node) => node.folder.id === 'root-a')
  assert.deepEqual(
    projects.children.map((node) => node.folder.name),
    ['Alpha', 'Zebra']
  )
  assert.equal(projects.children[0].children[0].folder.id, 'grandchild')
  assert.deepEqual(getFolderAncestorIds(folders, 'grandchild'), ['child-a', 'root-a'])
  assert.equal(getVisibleFolderIds(tree, new Set(['root-a'])).includes('child-a'), false)
  assert.deepEqual([...sanitizeCollapsedFolderIds(folders, ['root-a', 'missing'])], ['root-a'])
})

test('builds recursive folder scopes and counts without looping on invalid ancestry', () => {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const collection = (id, parentId = null) => ({
    schemaVersion: 2,
    id,
    name: id,
    icon: 'folder',
    createdAt: '2026-07-29T00:00:00.000Z',
    relativePath: id,
    parentId
  })
  const folders = [
    collection('project'),
    collection('research', 'project'),
    collection('sources', 'research'),
    collection('other'),
    collection('cycle-a', 'cycle-b'),
    collection('cycle-b', 'cycle-a')
  ]

  assert.deepEqual([...getFolderSubtreeIds(folders, 'project')], ['project', 'research', 'sources'])
  const counts = buildFolderSubtreeCounts(folders, [
    'project',
    'research',
    'sources',
    'sources',
    'other',
    'cycle-a'
  ])
  assert.equal(counts.get('project'), 4)
  assert.equal(counts.get('research'), 3)
  assert.equal(counts.get('sources'), 2)
  assert.equal(counts.get('other'), 1)
  assert.equal(counts.get('cycle-a'), 1)
  assert.equal(counts.get('cycle-b'), 1)
  assert.deepEqual(
    flattenFolderTree(folders)
      .filter(({ folder }) => !folder.id.startsWith('cycle'))
      .map(({ folder, depth }) => [folder.id, depth]),
    [
      ['other', 0],
      ['project', 0],
      ['research', 1],
      ['sources', 2]
    ]
  )
})
