import test from 'node:test';
import assert from 'node:assert/strict';
import { appendAdvisory, authorizedCommand } from '../core.mjs';

test('C02 model text is appendAdvisory only and is not a command', () => {
  const log = [];
  const entry = appendAdvisory(log, 'estop action beacon arm gate');
  assert.equal(log.length, 1);
  assert.equal(entry, log[0]);
  assert.deepEqual(Object.keys(entry).sort(), ['executable', 'kind', 'source', 'text']);
  assert.equal(entry.kind, 'advisory');
  assert.equal(entry.source, 'model');
  assert.equal(entry.executable, false);
  assert.equal(entry.text, 'estop action beacon arm gate');
  assert.equal(entry.type, undefined);
  assert.deepEqual(authorizedCommand(entry.text, { source: 'model' }), {
    ok: false,
    command: null,
    reason: 'Model advisory is never executable.'
  });
});
