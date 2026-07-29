import type { CollectionDto } from '../../../../shared/library-contract'

export interface FolderTreeNode {
  folder: CollectionDto
  children: FolderTreeNode[]
}

export interface FlatFolderTreeEntry {
  folder: CollectionDto
  depth: number
}

function hasValidAncestry(
  folder: CollectionDto,
  foldersById: ReadonlyMap<string, CollectionDto>
): boolean {
  const visited = new Set([folder.id])
  let parentId = folder.parentId
  while (parentId !== null) {
    if (visited.has(parentId)) return false
    visited.add(parentId)
    const parent = foldersById.get(parentId)
    if (!parent) return false
    parentId = parent.parentId
  }
  return true
}

export function buildFolderTree(folders: CollectionDto[]): FolderTreeNode[] {
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]))
  const nodesById = new Map<string, FolderTreeNode>(
    folders.map((folder) => [folder.id, { folder, children: [] }])
  )
  const roots: FolderTreeNode[] = []

  for (const folder of folders) {
    const node = nodesById.get(folder.id)
    if (!node) continue
    const parent = folder.parentId === null ? undefined : nodesById.get(folder.parentId)
    if (!parent || !hasValidAncestry(folder, foldersById)) roots.push(node)
    else parent.children.push(node)
  }

  const sortNodes = (nodes: FolderTreeNode[]): void => {
    nodes.sort((a, b) => a.folder.name.localeCompare(b.folder.name))
    for (const node of nodes) sortNodes(node.children)
  }
  sortNodes(roots)
  return roots
}

export function flattenFolderTree(folders: CollectionDto[]): FlatFolderTreeEntry[] {
  const entries: FlatFolderTreeEntry[] = []
  const visit = (node: FolderTreeNode, depth: number): void => {
    entries.push({ folder: node.folder, depth })
    for (const child of node.children) visit(child, depth + 1)
  }
  for (const root of buildFolderTree(folders)) visit(root, 0)
  return entries
}

export function getFolderAncestorIds(folders: CollectionDto[], folderId: string): string[] {
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]))
  const ancestors: string[] = []
  const visited = new Set([folderId])
  let parentId = foldersById.get(folderId)?.parentId ?? null

  while (parentId !== null && !visited.has(parentId)) {
    const parent = foldersById.get(parentId)
    if (!parent) break
    ancestors.push(parentId)
    visited.add(parentId)
    parentId = parent.parentId
  }
  return ancestors
}

export function getFolderSubtreeIds(folders: CollectionDto[], folderId: string): Set<string> {
  const childrenByParentId = new Map<string, string[]>()
  for (const folder of folders) {
    if (folder.parentId === null) continue
    const siblings = childrenByParentId.get(folder.parentId) ?? []
    siblings.push(folder.id)
    childrenByParentId.set(folder.parentId, siblings)
  }

  const subtreeIds = new Set([folderId])
  const queue = [folderId]
  for (let index = 0; index < queue.length; index += 1) {
    for (const childId of childrenByParentId.get(queue[index]) ?? []) {
      if (subtreeIds.has(childId)) continue
      subtreeIds.add(childId)
      queue.push(childId)
    }
  }
  return subtreeIds
}

export function buildFolderSubtreeCounts(
  folders: CollectionDto[],
  itemCollectionIds: Iterable<string>
): Map<string, number> {
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]))
  const counts = new Map<string, number>(folders.map((folder) => [folder.id, 0]))
  for (const collectionId of itemCollectionIds) {
    const visited = new Set<string>()
    let currentId: string | null = collectionId
    while (currentId !== null && !visited.has(currentId)) {
      visited.add(currentId)
      const folder = foldersById.get(currentId)
      if (!folder) break
      counts.set(currentId, (counts.get(currentId) ?? 0) + 1)
      currentId = folder.parentId
    }
  }
  return counts
}

export function sanitizeCollapsedFolderIds(
  folders: CollectionDto[],
  collapsedIds: Iterable<string>
): Set<string> {
  const validIds = new Set(folders.map((folder) => folder.id))
  return new Set([...collapsedIds].filter((id) => validIds.has(id)))
}

export function getVisibleFolderIds(
  nodes: FolderTreeNode[],
  collapsedIds: ReadonlySet<string>
): string[] {
  const visibleIds: string[] = []
  const visit = (node: FolderTreeNode): void => {
    visibleIds.push(node.folder.id)
    if (collapsedIds.has(node.folder.id)) return
    for (const child of node.children) visit(child)
  }
  for (const node of nodes) visit(node)
  return visibleIds
}
