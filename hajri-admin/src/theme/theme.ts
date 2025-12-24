import { MantineProvider, MantineThemeOverride } from '@mantine/core';

/**
 * Global Color Palette for Hajri Admin System
 * 
 * This provides consistent colors across the entire application.
 * Based on Mantine's color system with custom brand colors.
 */
export const theme: MantineThemeOverride = {
  // Primary brand colors
  primaryColor: 'blue',
  
  // Custom color palette
  colors: {
    // Brand colors
    brand: [
      '#E3F2FD', // 0 - lightest
      '#BBDEFB', // 1
      '#90CAF9', // 2
      '#64B5F6', // 3
      '#42A5F5', // 4
      '#2196F3', // 5 - primary
      '#1E88E5', // 6
      '#1976D2', // 7
      '#1565C0', // 8
      '#0D47A1', // 9 - darkest
    ],
    
    // Component type colors
    lecture: [
      '#E3F2FD',
      '#BBDEFB',
      '#90CAF9',
      '#64B5F6',
      '#42A5F5',
      '#2196F3', // Main lecture color (blue)
      '#1E88E5',
      '#1976D2',
      '#1565C0',
      '#0D47A1',
    ],
    
    lab: [
      '#F3E5F5',
      '#E1BEE7',
      '#CE93D8',
      '#BA68C8',
      '#AB47BC',
      '#9C27B0', // Main lab color (purple)
      '#8E24AA',
      '#7B1FA2',
      '#6A1B9A',
      '#4A148C',
    ],
    
    tutorial: [
      '#E8F5E9',
      '#C8E6C9',
      '#A5D6A7',
      '#81C784',
      '#66BB6A',
      '#4CAF50', // Main tutorial color (green)
      '#43A047',
      '#388E3C',
      '#2E7D32',
      '#1B5E20',
    ],
  },
  
  // Global spacing
  spacing: {
    xs: '0.5rem',   // 8px
    sm: '0.75rem',  // 12px
    md: '1rem',     // 16px
    lg: '1.5rem',   // 24px
    xl: '2rem',     // 32px
  },
  
  // Border radius
  radius: {
    xs: '0.25rem',  // 4px
    sm: '0.375rem', // 6px
    md: '0.5rem',   // 8px
    lg: '0.75rem',  // 12px
    xl: '1rem',     // 16px
  },
  
  // Shadows
  shadows: {
    xs: '0 1px 3px rgba(0, 0, 0, 0.05)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)',
    md: '0 3px 6px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.12)',
    lg: '0 10px 20px rgba(0, 0, 0, 0.15), 0 3px 6px rgba(0, 0, 0, 0.10)',
    xl: '0 15px 25px rgba(0, 0, 0, 0.15), 0 5px 10px rgba(0, 0, 0, 0.05)',
  },
  
  // Typography
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace: 'Monaco, Courier, monospace',
  
  headings: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontWeight: "700",
    sizes: {
      h1: { fontSize: '2rem', lineHeight: '2.5rem' },      // 32px
      h2: { fontSize: '1.5rem', lineHeight: '2rem' },      // 24px
      h3: { fontSize: '1.25rem', lineHeight: '1.75rem' },  // 20px
      h4: { fontSize: '1.125rem', lineHeight: '1.5rem' },  // 18px
      h5: { fontSize: '1rem', lineHeight: '1.5rem' },      // 16px
      h6: { fontSize: '0.875rem', lineHeight: '1.25rem' }, // 14px
    },
  },
  
  // Component-specific overrides
  components: {
    Button: {
      defaultProps: {
        radius: 'md',
      },
    },
    Card: {
      defaultProps: {
        shadow: 'sm',
        radius: 'md',
        withBorder: true,
      },
    },
    Paper: {
      defaultProps: {
        shadow: 'xs',
        radius: 'md',
      },
    },
    Modal: {
      defaultProps: {
        radius: 'md',
        overlayProps: {
          opacity: 0.55,
          blur: 3,
        },
      },
    },
    Input: {
      defaultProps: {
        radius: 'md',
      },
    },
    Select: {
      defaultProps: {
        radius: 'md',
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    Textarea: {
      defaultProps: {
        radius: 'md',
      },
    },
  },
  
  // Other theme settings
  defaultRadius: 'md',
  cursorType: 'pointer',
  
  // Breakpoints for responsive design
  breakpoints: {
    xs: '36em',   // 576px
    sm: '48em',   // 768px
    md: '62em',   // 992px
    lg: '75em',   // 1200px
    xl: '88em',   // 1408px
  },
};

/**
 * Helper function to get component type colors
 */
export const getComponentTypeColor = (type: string): string => {
  switch (type?.toUpperCase()) {
    case 'LECTURE':
      return 'blue';
    case 'LAB':
      return 'violet';
    case 'TUTORIAL':
      return 'green';
    default:
      return 'gray';
  }
};

/**
 * Semantic color tokens for consistent usage
 */
export const semanticColors = {
  // Status colors
  success: 'green',
  warning: 'yellow',
  error: 'red',
  info: 'blue',
  
  // UI element colors
  primary: 'blue',
  secondary: 'gray',
  accent: 'violet',
  
  // Component types
  lecture: 'blue',
  lab: 'violet',
  tutorial: 'green',
  
  // Text colors
  textPrimary: 'dark',
  textSecondary: 'dimmed',
  textDisabled: 'gray.5',
  
  // Background colors
  bgDefault: 'white',
  bgPaper: 'gray.0',
  bgElevated: 'white',
  
  // Border colors
  borderDefault: 'gray.3',
  borderLight: 'gray.2',
  borderDark: 'gray.4',
};

export default theme;
