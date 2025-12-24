import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'en-US',
  title: 'Hajri Documentation',
  description: 'Master documentation for Hajri Admin Portal + Hajri OCR',

  cleanUrls: true,
  lastUpdated: true,

  // Exclude legacy Docsify files from being treated as VitePress pages.
  srcExclude: ['**/_*.md'],

  // Docs include local dev API endpoints (e.g. http://localhost:8000).
  // This VitePress version expects ignoreDeadLinks to be boolean/array.
  ignoreDeadLinks: true,

  themeConfig: {
    siteTitle: 'Hajri Docs',

    nav: [
      { text: 'Getting Started', link: '/getting-started/' },
      { text: 'Admin Portal', link: '/hajri-admin/' },
      { text: 'OCR', link: '/hajri-ocr/' },
      { text: 'Troubleshooting', link: '/troubleshooting/' },
      { text: 'Chat Context', link: '/CHAT_CONTEXT' }
    ],

    outline: { level: [2, 3] },

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Home', link: '/' },
          { text: 'Start Here', link: '/getting-started/' },
          { text: 'Quick Start', link: '/QUICK_START' }
        ]
      },
      {
        text: 'Hajri Admin Portal',
        items: [
          { text: 'Overview', link: '/hajri-admin/' },
          { text: 'Architecture', link: '/hajri-admin/ARCHITECTURE' },
          { text: 'Schema V2', link: '/hajri-admin/SCHEMA_V2' },
          { text: 'Workflows', link: '/hajri-admin/WORKFLOWS' },
          { text: 'Deployment', link: '/hajri-admin/DEPLOYMENT' },
          { text: 'OAuth & Auth', link: '/hajri-admin/OAUTH' },
          { text: 'Performance', link: '/hajri-admin/PERFORMANCE' },
          { text: 'Roadmap', link: '/hajri-admin/ROADMAP' }
        ]
      },
      {
        text: 'Hajri OCR',
        items: [
          { text: 'Overview', link: '/hajri-ocr/' },
          { text: 'Project Overview', link: '/hajri-ocr/OVERVIEW' },
          { text: 'Architecture', link: '/hajri-ocr/ARCHITECTURE' }
        ]
      },
      {
        text: 'Reference',
        items: [
          { text: 'Troubleshooting', link: '/troubleshooting/' },
          { text: 'Chat Context', link: '/CHAT_CONTEXT' }
        ]
      }
    ],

    search: {
      provider: 'local'
    }
  }
})
