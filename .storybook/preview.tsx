import type { Preview } from '@storybook/react-vite'
import { useEffect } from 'react'

import '../src/renderer/src/assets/main.css'
import {
  applyControlStyle,
  applyTheme,
  DEFAULT_TYPOGRAPHY,
  type ControlStyle,
  type ResolvedTheme
} from '../src/renderer/src/hooks/theme'

function StoryTheme({
  children,
  mode,
  controlStyle
}: {
  children: React.ReactNode
  mode: ResolvedTheme
  controlStyle: ControlStyle
}): React.JSX.Element {
  useEffect(() => {
    applyTheme(mode, 'one', DEFAULT_TYPOGRAPHY)
    applyControlStyle(controlStyle)
  }, [mode, controlStyle])

  return <>{children}</>
}

const preview: Preview = {
  initialGlobals: { colorMode: 'light', controlStyle: 'skeuomorphic' },
  globalTypes: {
    colorMode: {
      description: 'Kuskus color mode',
      toolbar: {
        dynamicTitle: true,
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' }
        ]
      }
    },
    controlStyle: {
      description: 'Control surface style',
      toolbar: {
        dynamicTitle: true,
        icon: 'circlehollow',
        items: [
          { value: 'skeuomorphic', title: 'Skeuomorphic' },
          { value: 'flat', title: 'Flat' }
        ]
      }
    }
  },
  decorators: [
    (Story, context) => (
      <StoryTheme
        mode={context.globals.colorMode === 'dark' ? 'dark' : 'light'}
        controlStyle={context.globals.controlStyle === 'flat' ? 'flat' : 'skeuomorphic'}
      >
        <Story />
      </StoryTheme>
    )
  ],
  parameters: {
    layout: 'centered'
  }
}

export default preview
