# CodeClip

CodeClip is a React web application for turning code from tutorial screenshots into editable source files. Users can organize captures into projects, review and edit code, and update existing files after checking a merge preview.

## Running locally

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. On Windows PowerShell, use `npm.cmd` if `npm.ps1` is blocked.

## Current features

- Create, rename, duplicate, search, filter, and delete projects.
- Create, rename, edit, and delete files in different programming languages.
- Upload or drag in PNG, JPG, and WebP screenshots for preview and manual transcription.
- Try the review workflow using preset code samples.
- Save timestamped YouTube references and manually add code from a video.
- Review code, choose its language, and edit the filename before saving.
- Save a new file or preview changes to an existing file before accepting them.
- Detect exact overlapping lines at the boundary of two captures.
- Reopen saved captures from project history.
- Copy code, download individual source files, and download a project ZIP.
- Save projects locally in the browser.
- Use light/dark themes, editor preferences, and responsive layouts.

## Planned features

- AI vision extraction from uploaded screenshots.
- Automatic language identification and filename suggestions.
- Improved merge suggestions for changed or reordered code.
- Optional Chrome extension for capturing visible code from webpages.

Current screenshot entry is manual. Preset samples do not analyze uploaded images. The merge helper only removes exact overlap between the end of a file and the start of a capture; users should check the proposed result before accepting it.

## Local storage

Projects, files, reviewed capture text, and preferences are stored in this browser. Screenshot previews are session only. Clearing site data removes locally stored projects. Downloaded project ZIPs contain the source files, not capture images or application history.

## Development

```sh
npm test
npm run build
npm run preview
```

The production build uses `/CodeClip/` as its base path for GitHub Pages. The included workflow builds and deploys pushes to `main` when GitHub Pages is configured to use GitHub Actions.

## Stack

React, JavaScript, Vite, plain CSS, and JSZip.
