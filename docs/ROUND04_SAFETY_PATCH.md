# AETHER HUD — Round 04 security patch

2026-11-09 | source-of-truth `core.mjs` retained | no TypeScript port | one math core.

## Implemented in this patch

- `authorizedCommand(text,{source,voiceAuthority})` denies all model/unknown sources **before** calling the parser, blocks speech reset unconditionally, and allows speech arm/disarm/request only when the session-only voice-authority switch is explicitly enabled. Spoken emergency stop is always allowed.
- The app routes speech as `source:'speech'`, typed and button actions as `source:'operator'`. The voice-authority switch defaults false on each load, is not persisted, and changing it disarms the gate.
- `ActionGate` remains simulation-only and preserves its existing `arm()`, `activate(true)`, `stop()`, `reset()` assertions. Added independent source checks, action allowlist (`relay-1`), AbortSignal preflight, a separate safety audit, and stop-dominates-import logic.
- A visible simulated action confirmation button provides a human-controlled second step. Action requests from the command field alone cannot activate the SIM relay.
- `clear-log` clears only visible events, not the separate safety audit. JSON export now includes the safety audit, separately labeled.
- Updated service-worker cache version to avoid stale client files after deployment.

## Verified

- Existing suite: **10/10 passed**, unchanged.
- Additional safety regression suite: **15/15 passed**.
- Total on local Node.js: **25/25 passed, 0 failures**.
- JavaScript syntax checks: `core.mjs`, `app.mjs`, `xr.mjs`, `sw.js`, and both tests passed.

## Not verified / not built

- Local Chromium browser smoke test failed to navigate to loopback: `ERR_BLOCKED_BY_ADMINISTRATOR`. No UI screenshot or real user-interaction verification is claimed.
- Quest 3S XR session, phone camera, Web Bluetooth adapter, native Android system overlay and physical relay are untested or not built.
- AbortSignal is a **synchronous simulation preflight** only; no asynchronous hardware adapter is connected. It is **not** a physical E-stop.
- Audit is append-only within the running page and included in the manual session export; not durable across reload unless exported. Clearing visual events does not clear the in-memory audit.
- A future model-channel adapter must call only an advisory sink. No model backend is present.

## Commands

```
node --test tests/*.test.mjs
node --check core.mjs
node --check app.mjs
node --check xr.mjs
node --check sw.js
```

## Merge gate

Status `agreed: false`. Grok must run the entire **25-test** suite on this exact commit and verify browser behavior on a reachable HTTPS origin. No source replacement or new rendering/math core is authorized by this patch.
