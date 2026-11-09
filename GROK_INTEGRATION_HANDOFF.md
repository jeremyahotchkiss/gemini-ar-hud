# AETHER HUD × Grok Build: Integration Handoff

**Reference starter:** AetherHUD_v2_Grok_Starter.zip (download from the ChatGPT conversation and attach to Grok Build).
**Repository:** https://github.com/jeremyahotchkiss/gemini-ar-hud
**Collaboration branch:** feature/aether-hud-v2
**Grok output branch:** feature/grok-fusion-v1 (new branch; do not overwrite main)

## State of the project
- Original main branch has a single Three.js WebXR HUD prototype with animated AI orb and labeled demo target boxes. It is *not* a connected vision or AI system.
- The ChatGPT starter archive has a responsive local web/PWA console with five module views, animated canvas radar, virtual measuring and drawing, typed command interpreter, settings persistence, event logs/export, browser camera permission path, Web Bluetooth selection capability checks, guarded simulated hardware actions, and optional WebXR/WebGL graphics.
- Core source test suite: **10 passing Node tests** for 3D distance, virtual calibration, RSSI model, 2D trilateration/degeneracy, command parsing and action interlocks.
- Browser screenshot/e2e testing was **blocked by the current runner's administrator**; no hardware Quest validation has occurred. Fix and verify these areas in Grok.

## First do this: extract Grok's initial run
Inspect YOUR earlier Grok Build app/project context and source, if accessible. Record what the first run generated: working demo URL, screenshots, file tree, framework, components, real functions, demo placeholders, console errors, mobile performance, WebXR feature detection and permission behavior.
If an initial Grok build is not in the accessible context, write INITIAL_GROK_RUN_NOT_ACCESSIBLE and continue with the linked GitHub repo and attached ZIP. Never invent results.

## Build deliverables
1. docs/INITIAL_GROK_AUDIT.md, docs/FEATURE_MATRIX.md, docs/ARCHITECTURE.md, docs/QA_RESULTS.md
2. Merge best existing features with the starter. Separate UI, spatial math, renderer, WebXR, voice, BLE adapter, real camera, optional CV model, safety, telemetry and settings.
3. Full mobile responsive HUD; original 3D hologram, windows, sliders, toggles, annotation overlay, demo radar and target tags.
4. Quest 3S WebXR: detect immersive-ar and immersive-vr, graceful fallback, readable spatial panels and controller ray selection. Report physical Quest tests as unverified until actually run.
5. No claim of real object IDs, room measurement or accurate BLE positioning unless connected and verified. BLE RSSI is only coarse proximity. No client-side secret keys.
6. Optional real server LLM adapter with user-configured secrets; deterministic offline commands always remain usable.
7. Execute unit and browser E2E tests; inspect 390x844 Android portrait and desktop; remove dead controls, misleading LIVE labels, broken permissions and clutter.
8. Work on feature/grok-fusion-v1, commit changes, publish preview if allowed, return commit SHA, screenshots, test logs and honest REAL / UNVERIFIED / DEMO / PLANNED matrix.

## Safety
Hardware control remains simulated until an authenticated local bridge, operator confirmation and physical E-stop/interlock exist. Do not wire browser text commands directly to motors or relays.

## Usage
In Grok Build on mobile/web, attach the ZIP from ChatGPT, provide this repo link, and paste the full prompt from the ZIP's GROK_BUILD_HANDOFF.md. Grok Build's GitHub export can publish its changes to an appropriate branch.
