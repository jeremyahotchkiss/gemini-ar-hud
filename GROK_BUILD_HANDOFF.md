# GROK BUILD HANDOFF: AETHER HUD / PROJECT FUSION

## Role and mission
Act as senior Android/XR architect, graphics engineer, accessibility-focused UI/UX engineer, computer-vision integrator, QA engineer, and repo maintainer. Do not stop at a concept or mockup. Inspect, build, test, iterate, and deliver a working WebXR-ready app for Android and Meta Quest 3S. Preserve real features and stop presenting simulated data as live measurements.

## Canonical inputs
1. GitHub repository: https://github.com/jeremyahotchkiss/gemini-ar-hud
2. Branch created by another collaborator: `feature/aether-hud-v2`. Read and preserve its state; use a NEW branch `feature/grok-fusion-v1` for your work. Do not force-push or overwrite `main`.
3. Attached archive: `AetherHUD_v2_Grok_Starter.zip` (the tested vanilla JS PWA source). Inspect this archive before editing. This archive may contain improvements not yet uploaded to GitHub.
4. Optional reference lab: `Future_Fusion_Lab_12_Tested_Proofs.zip`, with BLE math, warehouse pathfinding, VR demo, servo simulation, orbital math, and diagrams.
5. If this is a continuation of an existing Grok Build session, inspect your FIRST prototype and the complete build transcript. If it is not available, state `INITIAL_GROK_RUN_NOT_ACCESSIBLE`, then audit the live app and provided inputs instead. Never fabricate prior output.

## Phase 0: extract the initial Grok build
Before making edits, report:
- Initial app/project URL and source files, if actually accessible
- Framework, major dependencies, feature inventory, component tree, routes, state management, test results
- Screenshots of phone and headset-preview states if available
- Confirmed runtime errors, broken controls, permission failures, unsupported browser APIs, security issues, missing functions
- Existing working features to preserve, differences versus attached starter and repository, and a precise merge plan
Write `docs/INITIAL_GROK_AUDIT.md` and `docs/FEATURE_MATRIX.md`. Use four status values: REAL_AND_TESTED, IMPLEMENTED_UNVERIFIED, SIMULATED, PLANNED. Every visual feature must have a corresponding real behavior or be explicitly labeled DEMO.

## Product specification
Name: AETHER HUD / Project Fusion. Build a futuristic but legible spatial command center, with original cyan/amber/violet geometry, animated AI core, subtle scan field, rounded glass panels, accessible contrast, 44px minimum touch targets, keyboard focus, reduced-motion preference and responsive layouts. Avoid copyrighted franchises/brands in assets. Support portrait Android, landscape Android, Quest Browser and desktop. Use a PWA first, then document native Android overlay path as a separate future module.

Modules:
A) HOME / SPATIAL: smooth animated 3D HUD, selectable targets, editable calibration, modes DEMO/CAMERA/XR, world-lock status, overlays, lines, markers, distances and clear button. Numeric 3D distance uses sqrt(dx²+dy²+dz²). Screen-distance uses explicit scale and is not called a physical measurement without calibration. Distinguish 2D trilateration from 3D; BLE RSSI alone is coarse, noisy proximity, not accurate 3D motion capture.
B) VISION: user-granted camera preview, manual labels and drawing overlay. Add optional *real* local object detection only when a supported model and browser acceleration exist, with model name, inference timestamps, confidence and FPS. Do not label static mock boxes as recognized objects. Add privacy controls.
C) DEVICES: capability detection, user-initiated Web Bluetooth device picker (where supported), selected-device details, connection/disconnection status, permission errors, simulated BLE beacons for unsupported browsers. Do not claim RSSI ranging from unsupported Web Bluetooth APIs. Add adapter interfaces for later Android BLE native scan.
D) COMMAND: deterministic local commands (status, select, grid on/off, measure, annotate, scan demo, emergency stop) that work offline; optional speech recognition with explicit permission, speech synthesis with an audio toggle; future server-side AI adapter, with API keys in server-side secrets, not in HTML/JS. Do not claim genuine remote LLM reasoning until connected and tested.
E) CONTROLS: opacity, brightness/glow, scene scale, range calibration, particles, grid, labels, motion reduction, data export/import, session logs and safe reset. Sliders and toggles must visibly update rendering and persist settings safely.
F) ACTIONS: demo actuator simulator with ARM -> CONFIRM -> EXECUTE gate, latched emergency stop, audit log, timeout and no physical control in browser-only demo. Provide an authenticated MQTT/ESP32 bridge design in docs only, with physical E-stop/interlock requirements, not an exposed public endpoint.
G) QUEST XR: feature-detect immersive-ar vs immersive-vr, request only required supported features, world-anchored holographic panels, WebGL/WebXR rendering, selection via controller rays or supported input profiles, readable spatial labels. Test fallback without headset and label Quest on-device tests UNVERIFIED until performed. Do not imply DOM panels overlay in immersive sessions unless supported.
H) ADVANCED LATER: occlusion, real anchors, local object recognition, hand pinch, anchor export/import, multiple HUD windows, gaze selection, native Android draw-over-apps, accessibility permissions, sensor fusion. Put them in roadmap unless actually built and verified.

## Architecture & code quality
Prefer maintainable TypeScript + Vite + Three.js or adapt existing vanilla JS modules if that produces fewer regressions. Prioritize operational code over rewriting everything. Keep modules separate for UI, rendering, math, command router, device adapters, permissions, XR, logging, safety, and settings. Use secure contexts for camera/voice/BT/XR. Gracefully degrade when permission or API is unavailable. Never hardcode Gemini/xAI/OpenAI keys. Never pretend camera recognition or external hardware controls are wired when they are not. Include content security and privacy recommendations, honest labels and clear errors.

## Actual work to execute
1. Inspect existing repo, attached archive and accessible initial Grok run; record facts.
2. Run the starter locally. Identify console errors and broken interactions on 390x844 mobile and desktop. Capture evidence.
3. Create a decision table: PRESERVE, REFACTOR, REPLACE, REMOVE for every starter and initial-Grok feature; reason for each.
4. Implement the combined v3 app with actual interactive controls and visual quality. No dead controls, misleading status fields or placeholder-only menus.
5. Run unit and browser E2E tests. Cover command parsing, settings persist, math, failure paths, draw/measure, permissions, safety state machine and XR availability fallback. Note exactly what cannot be tested without a Quest 3S.
6. Fix failing checks; inspect mobile viewport, text overflow, touch target size, performance and accessibility. Remove slop, duplicate controls, clutter, fake data labels and unnecessary dependencies.
7. Commit to NEW branch `feature/grok-fusion-v1`, provide commit SHA, file tree and diff summary, publish live preview if possible. Never merge or push to `main` without user instruction.
8. Produce `README.md`, `docs/ARCHITECTURE.md`, `docs/INITIAL_GROK_AUDIT.md`, `docs/FEATURE_MATRIX.md`, `docs/QA_RESULTS.md`, and `docs/QUEST_ANDROID_SETUP.md`.

## Release acceptance gate
- Fresh install/build runs with documented commands.
- A working radar demo, navigation, real stateful toggles/sliders, typed commands, measurement, annotation, safety gate, event export and settings persistence.
- Camera/Bluetooth/XR features honestly degrade when unavailable.
- No actual external device movement without operator consent, a hardware interlock and an authenticated local adapter.
- No exposed API credentials.
- Explicit pass/fail E2E report and on-device Quest checklist.
- Final response includes preview link, repo branch, commit SHA, screenshots, working features, simulated features and open issues.

## Execution directive
Begin with the audit, then proceed through implementation, test, correction and commit. Ask only when access is blocked or an irreversible external action requires authorization. Do not stop after a plan. Do not claim success without evidence. If you cannot access the initial Grok run, mark it unavailable and continue building from the attached archive and linked repository.
