/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(222 47% 6%)',
        foreground: 'hsl(210 20% 92%)',
        card: 'hsl(222 47% 9%)',
        'card-foreground': 'hsl(210 20% 92%)',
        popover: 'hsl(222 47% 10%)',
        'popover-foreground': 'hsl(210 20% 92%)',
        primary: 'hsl(217 91% 60%)',
        'primary-foreground': 'hsl(0 0% 100%)',
        secondary: 'hsl(222 30% 14%)',
        'secondary-foreground': 'hsl(210 20% 85%)',
        muted: 'hsl(222 25% 16%)',
        'muted-foreground': 'hsl(215 15% 55%)',
        accent: 'hsl(262 83% 58%)',
        'accent-foreground': 'hsl(0 0% 100%)',
        destructive: 'hsl(0 72% 51%)',
        'destructive-foreground': 'hsl(0 0% 100%)',
        border: 'hsl(222 25% 18%)',
        input: 'hsl(222 25% 12%)',
        ring: 'hsl(217 91% 60%)',
        success: 'hsl(160 84% 39%)',
        warning: 'hsl(43 96% 56%)',
        info: 'hsl(199 89% 48%)',
      },
      borderRadius: {
        lg: '0.625rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
    },
  },
  plugins: [],
}
