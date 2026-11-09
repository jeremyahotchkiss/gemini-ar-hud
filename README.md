# AETHER HUD v2 — Android / Quest Spatial Console Starter

A mobile-first, dependency-free modular web app and experimental WebXR visualizer. Developed as a practical starting point for a future spatial AI command center. **This is not a connected AI model or a true object-recognition system.**

## Run

```bash
python -m http.server 8080
# Open http://localhost:8080 on the same computer
```

For Android/Quest over a network, host under **HTTPS** rather than a LAN HTTP address; media permission, Web Bluetooth and WebXR require secure contexts. GitHub Pages or a trusted local HTTPS server are options. Open HTTPS URL in Quest Browser to check `immersive-ar`/`immersive-vr` support. Quest in-headset validation has not been completed here.

## Included functionality

- Responsive 3-column desktop / mobile-friendly HUD with animated radar canvas and demo anchors.
- Radar demo target selection, annotation by touch/mouse, virtual calibrated distance measurements, logs and JSON export.
- Five tabs: Radar, Vision, Devices, Telemetry, Controls.
- Local typed command parser; optional browser speech recognition and synthesis where exposed by browser.
- User-requested camera preview and Web Bluetooth picker, both with honest capability labels.
- Latched simulated safety stop and explicit simulated arm/confirm action flow.
- Settings sliders and switches saved locally. Offline cache via service worker after an HTTPS first load.
- Optional vanilla WebGL/WebXR scene with VR/AR mode detection and simple controller targeting.

## Limitations and next steps

- Anchor coordinates, object labels, scan counts and quality scores are **simulations**.
- Web Bluetooth device selection is **not distance ranging**, and ordinary RSSI cannot reliably produce precise 3D locations.
- On-screen 2D annotation is not a true Quest passthrough video overlay and isn't an Android system-wide overlay.
- No connected remote LLM, no real CV recognition and no real robot/servo outputs.
- The WebXR renderer has not been verified on a physical Quest 3S. Browser support varies.
- To merge with Grok Build, attach this project ZIP and use `GROK_BUILD_HANDOFF.md`. Preserve the original repository `main` branch.

## Tests

```bash
node --test tests/*.test.mjs
```

The Node suite covers math, the command parser, the simulated action gate, workspace import, operator-estimate calibration, and source checks for the HUD layout. It does not prove Quest, Android, Chromium visual, BLE, camera, or hardware behavior. `agreed` stays false.

## Source tree

- `index.html`, `style.css`: responsive UI and accessibility markup
- `app.mjs`: user interactions and canvas radar
- `core.mjs`: pure math and deterministic command/action logic
- `xr.mjs`: optional WebXR/WebGL scene
- `sw.js`, `manifest.webmanifest`, `icons/`: PWA shell
- `tests/core.test.mjs`: automated tests
- `GROK_BUILD_HANDOFF.md`: cross-tool build and QA prompt

## Round 04 safety update

The source-aware command policy requires explicitly identified sources and denies model text and untrusted command sources, restricts spoken high-authority commands, and makes the simulated action-confirmation step available through an explicit UI button. A session-only voice-authority toggle is OFF by default; spoken reset of the stop latch remains prohibited. The simulated gate audits all state transitions and rejects unlisted actions and pre-aborted signals. No physical outputs are attached.

Run the original tests and the new regression suite together:

```bash
node --test tests/*.test.mjs
```

See `docs/ROUND04_SAFETY_PATCH.md` for evidence and current limitations. Browser/Quest hardware validation is still outstanding.
