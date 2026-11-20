import { heroui } from '@heroui/theme';

export default heroui({
  defaultTheme: 'dark',
  themes: {
    light: {
      colors: {
        background: '#F6F7FA', foreground: '#202633',
        content1: '#FFFFFF', content2: '#EEF1F5', content3: '#DFE4EB', content4: '#CCD3DD',
        primary: { DEFAULT: '#A63E26', foreground: '#FFFFFF' },
        focus: '#A63E26', divider: '#D4DAE2',
        default: { 400: '#626C7C', 500: '#545E6E' },
      },
    },
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
