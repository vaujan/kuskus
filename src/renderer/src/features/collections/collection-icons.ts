import {
  IconArchive,
  IconBarbell,
  IconBook,
  IconBookmark,
  IconBriefcase,
  IconBuilding,
  IconBulb,
  IconCalendar,
  IconCamera,
  IconChartBar,
  IconCode,
  IconCurrencyDollar,
  IconDeviceGamepad,
  IconFlask,
  IconFolder,
  IconHeart,
  IconHome,
  IconLeaf,
  IconMap,
  IconMusic,
  IconNotes,
  IconPalette,
  IconPhoto,
  IconPlane,
  IconRocket,
  IconSchool,
  IconShoppingBag,
  IconStar,
  IconTool,
  IconUser,
  IconUsers,
  IconVideo,
  type TablerIcon
} from '@tabler/icons-react'
import { createElement, type ComponentProps } from 'react'

import type { CollectionIconKey } from '../../../../shared/library-contract'

export interface CollectionIconOption {
  key: CollectionIconKey
  label: string
  keywords: string
  icon: TablerIcon
}

export const COLLECTION_ICON_OPTIONS: readonly CollectionIconOption[] = [
  { key: 'folder', label: 'Folder', keywords: 'default files', icon: IconFolder },
  { key: 'briefcase', label: 'Briefcase', keywords: 'work business project', icon: IconBriefcase },
  { key: 'palette', label: 'Palette', keywords: 'design art creative', icon: IconPalette },
  { key: 'code', label: 'Code', keywords: 'development programming', icon: IconCode },
  { key: 'rocket', label: 'Rocket', keywords: 'launch startup', icon: IconRocket },
  { key: 'bulb', label: 'Idea', keywords: 'light inspiration', icon: IconBulb },
  { key: 'bookmark', label: 'Bookmark', keywords: 'saved reference', icon: IconBookmark },
  { key: 'book', label: 'Book', keywords: 'reading library', icon: IconBook },
  { key: 'school', label: 'School', keywords: 'learning education study', icon: IconSchool },
  { key: 'flask', label: 'Research', keywords: 'science experiment lab', icon: IconFlask },
  { key: 'chart', label: 'Chart', keywords: 'analytics metrics growth', icon: IconChartBar },
  { key: 'finance', label: 'Finance', keywords: 'money budget dollar', icon: IconCurrencyDollar },
  { key: 'shopping', label: 'Shopping', keywords: 'store purchases bag', icon: IconShoppingBag },
  { key: 'home', label: 'Home', keywords: 'house personal', icon: IconHome },
  { key: 'heart', label: 'Heart', keywords: 'favorite love health', icon: IconHeart },
  { key: 'star', label: 'Star', keywords: 'favorite important', icon: IconStar },
  { key: 'music', label: 'Music', keywords: 'audio song', icon: IconMusic },
  { key: 'photo', label: 'Photo', keywords: 'image gallery', icon: IconPhoto },
  { key: 'video', label: 'Video', keywords: 'movie film', icon: IconVideo },
  { key: 'camera', label: 'Camera', keywords: 'photography screenshot', icon: IconCamera },
  { key: 'gaming', label: 'Gaming', keywords: 'game controller', icon: IconDeviceGamepad },
  { key: 'travel', label: 'Travel', keywords: 'plane trip vacation', icon: IconPlane },
  { key: 'map', label: 'Map', keywords: 'location place route', icon: IconMap },
  { key: 'calendar', label: 'Calendar', keywords: 'date schedule event', icon: IconCalendar },
  { key: 'team', label: 'Team', keywords: 'people group users', icon: IconUsers },
  { key: 'person', label: 'Person', keywords: 'user profile individual', icon: IconUser },
  { key: 'building', label: 'Building', keywords: 'company office', icon: IconBuilding },
  { key: 'tools', label: 'Tools', keywords: 'workshop utility repair', icon: IconTool },
  { key: 'archive', label: 'Archive', keywords: 'storage old', icon: IconArchive },
  { key: 'nature', label: 'Nature', keywords: 'leaf plant environment', icon: IconLeaf },
  { key: 'fitness', label: 'Fitness', keywords: 'barbell workout gym', icon: IconBarbell },
  { key: 'notes', label: 'Notes', keywords: 'writing document text', icon: IconNotes }
]

const COLLECTION_ICON_COMPONENTS = new Map(
  COLLECTION_ICON_OPTIONS.map(({ key, icon }) => [key, icon] as const)
)

export function getCollectionIcon(key: CollectionIconKey): TablerIcon {
  return COLLECTION_ICON_COMPONENTS.get(key) ?? IconFolder
}

export function CollectionIcon({
  icon,
  ...props
}: { icon: CollectionIconKey } & ComponentProps<TablerIcon>): React.JSX.Element {
  return createElement(getCollectionIcon(icon), props)
}
