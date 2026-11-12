import { heroui } from '@heroui/theme';

export default heroui({
  defaultTheme: 'dark',
  themes: {
    dark: {
      colors: {
        background: '#090B10', foreground: '#F4F4F5',
        content1: '#12151D', content2: '#191D27', content3: '#232936', content4: '#303848',
        primary: { DEFAULT: '#F27055', foreground: '#FFFFFF' },
        focus: '#F27055', divider: '#FFFFFF14',
      },
    },
  },
});
