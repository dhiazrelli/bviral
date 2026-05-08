# BVIRAL Video Editor

This directory contains the vendored browser video editor used by BVIRAL AI Studio.
It runs as a separate Next.js app so timeline editing, media handling, WebCodecs/PixiJS
rendering, and export work stay isolated from the main dashboard bundle.

## Run Locally

```powershell
pnpm --dir artifacts/openvideo install
pnpm --dir artifacts/openvideo run dev
```

Open:

```text
http://localhost:3000/projects
```

## Branding

- Browser metadata, project screens, editor header, logo usage, export filenames, and local storage keys are branded for BVIRAL.
- The main dashboard embeds this app from AI Studio using `VITE_BVIRAL_VIDEO_EDITOR_URL`, defaulting to `http://localhost:3000/projects`.

## Environment

Optional AI and media integrations are configured from `.env.sample`, including Deepgram,
ElevenLabs, Pexels, and R2/S3-compatible storage.

## License

This vendored editor is based on a third-party dual-licensed project. Review `LICENSE`
and `LICENSE-AGPL3.md` before production or commercial distribution.
