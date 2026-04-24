# Font for PDF Export

The PDF export feature (`/api/admin/conversations/:id/export/pdf`) needs a TTF font that covers **both Thai and Latin glyphs**.
Without it, the PDF renders those characters as empty boxes. Word export works without this step.

## Install

We use **Sarabun-Regular.ttf** (Thai + Latin in one font). Place it here:

```
fonts/Sarabun-Regular.ttf
```

### One-liner (PowerShell)

```powershell
Invoke-WebRequest -Uri "https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Regular.ttf" -OutFile "fonts/Sarabun-Regular.ttf"
```

### One-liner (bash / Linux)

```bash
curl -L -o fonts/Sarabun-Regular.ttf https://github.com/google/fonts/raw/main/ofl/sarabun/Sarabun-Regular.ttf
```

Font license: [SIL Open Font License 1.1](https://openfontlicense.org/)

## Why Sarabun and not Noto Sans Thai?

Google's `NotoSansThai` is a Thai-only font (no Latin/digits). A PDF with mixed Thai + Latin text would
show boxes for the Latin half. Sarabun bundles both scripts in a single ~90 KB TTF, which is the simplest
setup for `pdfkit` (which doesn't support font fallback out of the box).

## Deploy

The `Dockerfile` copies `fonts/` into the runtime image via `COPY fonts ./fonts`. Commit the TTF file
to the repo so the production container has the font at runtime.

If the file is missing, the server still boots and generates PDFs — it just uses Helvetica as a fallback,
which means Thai characters render as squares. The warning `[export] Thai font not found ...` appears in
server logs at startup to flag this.
