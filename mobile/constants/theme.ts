/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const Palette = { canvas: '#FFF9F0', paper: '#FFFFFF', ink: '#2A1D18', muted: '#786A62', coral: '#F25F45', coralDark: '#C94331', saffron: '#F6B91A', peach: '#FFE7D8', sage: '#DCE9DB', line: '#E9DDD2', danger: '#B42318' } as const;

export const UserPalette = { canvas: '#111111', paper: '#1B1B1B', ink: '#F8F5F2', muted: '#AAA39E', coral: '#F25F45', coralDark: '#FF806A', saffron: '#F6B91A', peach: '#30221E', sage: '#263329', line: '#303030', danger: '#FF756A' } as const;

export const Shadows = { soft: { shadowColor: '#543025', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 } };

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: Palette.ink, background: Palette.canvas, tint: Palette.coral, icon: Palette.muted, tabIconDefault: Palette.muted, tabIconSelected: Palette.coral,
  },
  dark: {
    text: Palette.ink, background: Palette.canvas, tint: Palette.coral, icon: Palette.muted, tabIconDefault: Palette.muted, tabIconSelected: Palette.coral,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
