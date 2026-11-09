import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizedCommand, command } from '../core.mjs';

test('packet command lines use the existing parser, with ChatGPT aliases kept', () => {
  const lines = [
    ['help', 'help'],
    ['status', 'status'],
    ['units ft', 'units'],
    ['place D 1 0 -2', 'place'],
    ['select A', 'select'],
    ['measure A B', 'measure'],
    ['calibrate 1 1.02', 'calibrate'],
    ['sigma 0.02', 'sigma'],
    ['remove C', 'remove'],
    ['arm', 'arm'],
    ['disarm', 'disarm'],
    ['estop', 'estop'],
    ['reset-estop', 'reset-estop'],
    ['action beacon', 'action'],
    ['sim off', 'sim'],
    ['voice on', 'voice'],
    ['voice-authority off', 'voice-authority'],
    ['tag door', 'tag'],
    ['ask what is the range', 'ask'],
    ['note check calibration', 'note'],
    ['clear-log', 'clear-log']
  ];
  for (const [line, type] of lines) assert.equal(command(line).type, type, line);
  assert.equal(command('action laser').type, 'unknown');
  assert.equal(command('action relay-1').id, 'relay-1');
  assert.equal(command('action marker-pulse').id, 'marker-pulse');
  assert.equal(command('emergency stop').type, 'stop');
  assert.equal(command('E-STOP!').type, 'stop');
  assert.equal(command('open gate').type, 'gate');
  assert.equal(command('reset safety').type, 'reset');
  assert.deepEqual(command('grid off'), { type: 'toggle', key: 'grid', value: false });
  assert.equal(command('Please measure the room').type, 'measure');
  assert.equal(command('focus A1').id, 'A1');
  assert.equal(command('calibrate 1 1.02').knownM, 1);
  assert.equal(command('calibrate 1 1.02').measuredM, 1.02);
  assert.equal(command('sigma 0.02').pointSigma, 0.02);
  assert.equal(command('units ft').unit, 'ft');
  assert.deepEqual(command('place D 1 0 -2').position, [1, 0, -2]);
});

test('speech can estop, and cannot reset, arm, disarm, or act unless voice authority is on', () => {
  assert.equal(authorizedCommand('estop', { source: 'speech', voiceAuthority: false }).ok, true);
  assert.equal(authorizedCommand('emergency stop', { source: 'speech' }).command.type, 'stop');
  assert.equal(authorizedCommand('reset-estop', { source: 'speech', voiceAuthority: true }).ok, false);
  assert.equal(authorizedCommand('reset safety', { source: 'speech', voiceAuthority: true }).ok, false);
  for (const phrase of ['arm', 'disarm', 'action beacon', 'open gate']) {
    assert.equal(authorizedCommand(phrase, { source: 'speech', voiceAuthority: false }).ok, false, phrase);
  }
  assert.equal(authorizedCommand('action beacon', { source: 'speech', voiceAuthority: true }).command.type, 'action');
  assert.equal(authorizedCommand('voice-authority on', { source: 'speech', voiceAuthority: false }).ok, false);
  assert.equal(authorizedCommand('voice-authority on', { source: 'operator' }).command.value, true);
});
