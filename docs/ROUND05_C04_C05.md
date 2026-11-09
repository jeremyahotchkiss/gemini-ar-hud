# AETHER HUD — Round 05 C03/C04/C05 implementation notes

## C03 safety hardening

- The default simulated allowlist is `beacon`, `relay-1`, and `marker-pulse`.
- `ActionGate` no longer defaults omitted command provenance to `operator`.
- A final confirmed activation requires `source: 'operator'`; speech authority can request an action but cannot provide the final confirmation.
- The gate remains simulation-only. `AbortSignal` is a synchronous preflight, not a physical stop circuit.

## C04 workspace v1

- `workspace.mjs` is pure JavaScript and has no browser, storage, camera, XR, or device dependencies.
- `normalizeWorkspace`, `parseWorkspaceJSON`, and `serializeWorkspace` accept v1, ignore unknown keys, reject other versions, invalid IDs, duplicate IDs, non-finite coordinates, invalid units, and non-positive calibration scale.
- `estopLatched` is preserved; imports always normalize `armed` to `false`. `ActionGate.restore` remains responsible for preserving an already latched runtime stop.
- `voiceAuthority` is intentionally omitted from workspace serialization because the newer C02 decision makes it session-only and non-persistent. This supersedes its appearance in the older Round 03 settings list.
- `calibration.scale` is accepted as a legacy import alias, but normalized/exported as `calibration.calibrationScale`. Visual scene scale is `settings.sceneScale`.
- A1/B2/C3/D4 are available through the optional `legacyWorkspaceFixture()`; they are synthetic demonstration anchors, not room measurements.
- The module does not access or overwrite `localStorage` visual settings.

## C05 measurement estimates

- `distance3` and `virtualPixelDistance` remain unchanged and authoritative for raw 3D and virtual-plane measurements.
- `calibrate(knownM, measuredM)` returns `knownM / measuredM` and rejects non-finite or non-positive values.
- `calibratedMeters(rawMeters, calibrationScale)` applies the operator-entered correction as a separate step.
- `sigma(pointSigmaM, calibrationScale)` returns `pointSigmaM * sqrt(2) * calibrationScale` for independent isotropic point-error estimates. It is not a confidence interval and excludes calibration uncertainty/correlated errors.
- `convertLength` and `formatLength` support m, cm, mm, ft, and in.

## Verification

Run `node --test tests/*.test.mjs`. Device, Chromium visual, BLE, camera, Quest, and hardware QA remain separate and unclaimed until performed.