# MMS Font Assets Repository

This directory contains mounted font files for the Typst BiDi Headless Document Engine.

## Supported Fonts

- **Urdu Nastaliq**: `Noto Nastaliq Urdu` (Regular, Bold)
- **Arabic / Persian**: `Readex Pro` (300, 400, 500, 600, 700)
- **Latin / Sans**: `Geist`, `Liberation Sans`

## Deployment & Mounting

In production Linux / Container deployments:

- Fonts can be placed in this directory or installed system-wide in `/usr/share/fonts/`
- Set `TYPST_FONT_DIR` environment variable to override the font search path if custom font directory is used.
