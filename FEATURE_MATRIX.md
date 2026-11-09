# Feature matrix (2026-11-09)

| Feature | Status | Evidence / limitation |
|---|---|---|
| Responsive HUD screens | Implemented, browser QA pending | HTML/CSS and JS present |
| Animated demo spatial radar | Implemented | Browser canvas; simulated targets |
| 2D virtual measure | Core tested | Calibration on rendered viewport, not surveyed depth |
| 3D distance math | Core tested | Pythagorean Euclidean distance |
| 2D trilateration | Core tested | Requires real distance inputs; not a BLE scanner |
| Typed local commands | Core tested | Rule-based, not a cloud LLM |
| Action-gate safety model | Core tested | Simulation; no actuator |
| Manual drawing | Implemented, browser QA pending | Canvas annotation |
| Camera preview | Feature-gated; hardware unverified | Permission + browser API required |
| Web Bluetooth | Feature-gated; hardware unverified | Selection only, no ranging |
| Voice commands | Feature-gated; hardware unverified | Browser speech support varies |
| Browser WebXR scene | Implemented, Quest QA pending | AR/VR session selection with WebGL |
| True room object recognition | Planned | No computer vision model connected |
| Android global system overlay | Planned | Requires native Android app/API permissions |
| Physical robot output | Planned | No real hardware connected |
| Remote AI model | Planned | Needs secure server-side bridge |
| Grok initial build extraction | Not yet available | User's Grok session or published link not supplied |
