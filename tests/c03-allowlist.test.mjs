import test from 'node:test';
import assert from 'node:assert/strict';
import { ActionGate, HARDWARE_ALLOWLIST } from '../core.mjs';

test('C03 default hardware allowlist is beacon, relay-1, and marker-pulse', () => {
  assert.deepEqual(HARDWARE_ALLOWLIST, ['beacon', 'relay-1', 'marker-pulse']);
  const gate = new ActionGate();
  assert.deepEqual(gate.hardwareAllowlist, ['beacon', 'relay-1', 'marker-pulse']);
  assert.equal(gate.connected, false);
  for (const id of HARDWARE_ALLOWLIST) {
    assert.equal(gate.arm('operator').ok, true, id);
    const result = gate.activate(true, id, { source: 'operator' });
    assert.equal(result.ok, true, id);
    assert.equal(gate.armed, false, id);
  }
  assert.equal(gate.activations, 3);
  assert.equal(gate.arm('operator').ok, true);
  assert.equal(gate.activate(true, 'laser', { source: 'operator' }).ok, false);
  assert.equal(gate.activations, 3);
  assert.equal(gate.connected, false);
});
