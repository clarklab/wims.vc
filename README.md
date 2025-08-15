# wims.vc Blog Generator

A simple static site generator that converts markdown files to HTML using a template.

## Usage

### Build all posts once
```bash
npm run build
```

### Watch for changes and rebuild automatically
```bash
npm run watch
# or
npm run dev
```

## How it works

1. **Markdown files** go in the `blog-posts/` directory
2. **HTML files** are generated in the `blog/` directory
3. **Template** is defined in `blog-template.htm`

## Markdown format

Each markdown file should start with simple metadata:

```markdown
Title: Your Post Title
Author: Your Name
Posted: Date

Your markdown content goes here...

## Subheadings work great

Regular markdown syntax is supported.
```

## Features

- ✅ Simple metadata parsing (Title, Author, Posted)
- ✅ Markdown to HTML conversion
- ✅ Template-based rendering
- ✅ Watch mode for development
- ✅ Automatic rebuilding on file changes
- ✅ Clean, minimal output

## File structure

```
wims.vc/
├── blog-posts/           # Your markdown files
│   └── hello-world.md
├── blog/                 # Generated HTML files
│   └── hello-world.html
├── blog-template.htm     # HTML template
├── build.js             # Build script
└── package.json         # Dependencies and scripts
```

The generator will automatically create the `blog/` directory if it doesn't exist.
