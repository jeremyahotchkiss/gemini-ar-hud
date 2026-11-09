import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.mjs', import.meta.url), 'utf8');
const xr = fs.readFileSync(new URL('../xr.mjs', import.meta.url), 'utf8');

function fontSizes(source) {
  const withoutSr = source.replace(/\.sr-only\{[^}]*\}/g, '');
  const sizes = [];
  for (const match of withoutSr.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) sizes.push(Number(match[1]));
  for (const match of withoutSr.matchAll(/font:\s*(?:(?:bold|\d{3})\s+)?(\d+(?:\.\d+)?)px/g)) sizes.push(Number(match[1]));
  for (const match of withoutSr.matchAll(/font\s*=\s*['"](?:bold\s+)?(\d+(?:\.\d+)?)px/g)) sizes.push(Number(match[1]));
  return sizes;
}

test('locked palette is tokenized and focus does not outline with border-on-background', () => {
  for (const [name, value] of [
    ['--bg', '#07121f'],
    ['--surface', '#0a2130'],
    ['--fg', '#e7f6f2'],
    ['--muted', '#8aa8a4'],
    ['--primary', '#00f3ff'],
    ['--danger', '#ff5d4a'],
    ['--border', '#214858']
  ]) {
    assert.match(css, new RegExp(`${name}:${value}`));
  }
  assert.match(css, /body\{[^}]*background:var\(--bg\)/);
  assert.match(css, /body\{[^}]*color:var\(--fg\)/);
  assert.match(css, /outline:\s*2px solid var\(--primary\)/);
  assert.doesNotMatch(css, /outline:[^;}]*var\(--border\)/);
  assert.doesNotMatch(css, /outline:[^;}]*var\(--amber\)/);
});

test('author font sizes are at least 14px and comfortable copy is at least 18px', () => {
  const sizes = [...fontSizes(css), ...fontSizes(html), ...fontSizes(app)];
  assert.ok(sizes.length > 10);
  const tiny = sizes.filter(size => size < 14);
  assert.deepEqual(tiny, []);
  assert.match(css, /body\{[^}]*font-size:18px/);
  assert.match(css, /\.agent-reply\{[^}]*font-size:18px/);
  assert.match(css, /\.honesty-banner\{[^}]*font-size:18px/);
  assert.match(app, /font-size:18px/);
  assert.match(app, /18px sans-serif/);
});

test('ESTOP, safety state, and simulation banner stay visible at every width', () => {
  assert.match(html, /id="btn-estop-quick"[^>]*>ESTOP</);
  assert.match(html, /id="top-safety-state"/);
  assert.match(html, /class="honesty-banner"[^>]*>SIMULATION \/ NOT A ROOM SCAN</);
  for (const hidden of ['#btn-estop-quick{display:none}', '#top-safety-state{display:none}', '.honesty-banner{display:none}', '.mode-badge{display:none}', '.header-center{display:none}']) {
    assert.equal(css.includes(hidden), false, hidden);
  }
  const estopRules = css.match(/#btn-estop-quick\{[^}]*\}/g) || [];
  assert.ok(estopRules.length >= 1);
  for (const rule of estopRules) {
    for (const prop of ['min-height', 'min-width', 'height', 'width']) {
      const found = rule.match(new RegExp(`${prop}:(\\d+(?:\\.\\d+)?)px`));
      if (found) assert.ok(Number(found[1]) >= 60, `${prop} in ${rule}`);
    }
  }
  assert.match(css, /#btn-estop-quick\{[^}]*min-height:60px/);
  assert.match(css, /#btn-estop-quick\{[^}]*min-width:60px/);
  assert.match(css, /#btn-estop-quick\{[^}]*margin-inline:16px/);
  assert.match(css, /#btn-estop-quick\{[^}]*background:#521e18/);
  assert.match(css, /#btn-estop-quick\{[^}]*color:var\(--fg\)/);
  assert.match(css, /\.btn\{[^}]*min-height:48px/);
  assert.match(css, /\.mic-btn\{[^}]*width:48px/);
  assert.match(css, /\.mic-btn\{[^}]*height:48px/);
});

test('WebXR world panel repeats the simulation legend and only reads gate state', () => {
  assert.match(xr, /SIMULATION \/ NOT A ROOM SCAN/);
  assert.match(xr, /STOP LATCHED/);
  assert.match(xr, /ESTOP/);
  assert.match(xr, /getSafety/);
  assert.doesNotMatch(xr, /gate\.(arm|stop|activate|reset)\(/);
  assert.match(app, /getSafety:\(\)=>\(\{armed:gate\.armed,stopped:gate\.stopped\}\)/);
  assert.match(html, /SIMULATION \/ NOT A ROOM SCAN/);
});

test('glow stays 0-100 and scene scale does not share calibrationScale', () => {
  assert.match(html, /id="glow"[^>]*min="0"[^>]*max="100"[^>]*value="72"/);
  assert.match(html, /id="scale"[^>]*min="20"[^>]*max="100"/);
  assert.doesNotMatch(html, /calibrationScale/);
  assert.match(app, /sceneScale:state\.settings\.scale/);
  assert.match(xr, /shaderGlow\(/);
});
