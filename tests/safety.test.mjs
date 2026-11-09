import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizedCommand, command, ActionGate } from '../core.mjs';

test('model advisory is denied before invoking the command parser', () => {
  assert.deepEqual(authorizedCommand('emergency stop arm gate', { source: 'model' }),
    { ok: false, command: null, reason: 'Model advisory is never executable.' });
});
test('unknown input sources cannot execute commands', () => {
  assert.equal(authorizedCommand('arm gate', { source: 'untrusted' }).ok, false);
  assert.equal(authorizedCommand('emergency stop', { source: undefined }).ok, false);
});
test('speech emergency stop is permitted without voice authority', () => {
  const result=authorizedCommand('emergency stop', { source: 'speech', voiceAuthority: false });
  assert.equal(result.ok, true);
  assert.equal(result.command.type, 'stop');
  const gate=new ActionGate();
  assert.equal(gate.stop('speech').ok, true);
  assert.equal(gate.stopped, true);
});
test('speech reset is denied even with voice authority', () => {
  assert.equal(authorizedCommand('reset safety', { source: 'speech', voiceAuthority: true }).ok, false);
  const gate=new ActionGate(); gate.stop('operator');
  assert.equal(gate.reset('speech').ok, false);
  assert.equal(gate.stopped, true);
});
test('speech arm, disarm, gate request blocked when authority is off', () => {
  for(const phrase of ['arm gate','disarm','open gate']){
    const a=authorizedCommand(phrase,{source:'speech',voiceAuthority:false});
    assert.equal(a.ok,false,phrase);
  }
  const gate=new ActionGate();
  assert.equal(gate.arm('speech').ok,false);
  assert.equal(gate.armed,false);
});
test('voice authority enables speech requests but final confirmation stays operator-only', () => {
  const a=authorizedCommand('arm gate',{source:'speech',voiceAuthority:true});
  assert.equal(a.ok,true);
  const gate=new ActionGate();
  assert.equal(gate.arm('speech',true).ok,true);
  assert.equal(gate.activate(false,'relay-1',{source:'speech',voiceAuthority:true}).ok,false);
  assert.equal(gate.activate(true,'relay-1',{source:'speech',voiceAuthority:true}).ok,false);
  assert.equal(gate.activations,0);
  assert.equal(gate.activate(true,'relay-1',{source:'operator'}).ok,true);
  assert.equal(gate.armed,false);
});
test('hardware gate rejects model and unknown source, regardless of armed state', () => {
  const gate=new ActionGate(); gate.arm('operator');
  assert.equal(gate.activate(true,'relay-1',{source:'model'}).ok,false);
  assert.equal(gate.activate(true,'relay-1',{source:'forged'}).ok,false);
  assert.equal(gate.arm('model').ok,false);
  assert.equal(gate.armed,true);
  assert.equal(gate.activations,0);
});
test('default allowlist includes beacon, relay-1 and marker-pulse only', () => {
  const gate=new ActionGate();
  for(const id of ['beacon','relay-1','marker-pulse']){
    gate.arm('operator');
    assert.equal(gate.activate(true,id,{source:'operator'}).ok,true,id);
  }
  gate.arm('operator');
  assert.equal(gate.activate(true,'laser',{source:'operator'}).ok,false);
  assert.equal(gate.activations,3);
});
test('latched emergency stop rejects any action and any arm', () => {
  const gate=new ActionGate();gate.arm('operator');gate.stop('speech');
  assert.equal(gate.armed,false);
  assert.equal(gate.activate(true,'relay-1',{source:'operator'}).ok,false);
  assert.equal(gate.arm('operator').ok,false);
  assert.equal(gate.activations,0);
});
test('imported stop wins and imported armed never enables a relay', () => {
  const gate=new ActionGate();gate.arm('operator');
  assert.deepEqual(gate.restore({estopLatched:true,armed:true}),{stopped:true,armed:false});
  assert.equal(gate.restore({stopped:false,armed:true}).stopped,true);
  assert.equal(gate.reset('speech').ok,false);
});
test('restoring an unlatched snapshot still forces disarm', () => {
  const gate=new ActionGate();gate.arm('operator');
  assert.deepEqual(gate.restore({stopped:false,armed:true}),{stopped:false,armed:false});
});
test('aborted signal never counts as simulated action success', () => {
  const gate=new ActionGate();gate.arm('operator');
  const controller=new AbortController();controller.abort();
  assert.equal(gate.activate(true,'relay-1',{source:'operator',signal:controller.signal}).ok,false);
  assert.equal(gate.activations,0);
});
test('the safety audit stays separate from the clear-log command', () => {
  const gate=new ActionGate();gate.arm('operator');gate.stop('operator');
  const audit=gate.getAudit();
  assert.equal(command('clear-log').type,'clear-log');
  assert.equal(gate.getAudit().length,2);
  audit[0].result='forged';
  assert.notEqual(gate.getAudit()[0].result,'forged');
});
test('reset by operator disarms and cannot activate without a new arm',()=>{
  const gate=new ActionGate();gate.arm('operator');gate.stop('operator');gate.reset('operator');
  assert.equal(gate.activate(true,'relay-1',{source:'operator'}).ok,false);
  assert.equal(gate.armed,false);
  assert.ok(gate.getAudit().some(x=>x.event==='reset-estop'&&x.result==='ok'));
});
test('invalid action allowlist fails closed',()=>{
  assert.throws(()=>new ActionGate({allowlist:['relay-1',42]}),TypeError);
  assert.throws(()=>new ActionGate({allowlist:[]}),TypeError);
  assert.throws(()=>new ActionGate({allowlist:['laser']}),TypeError);
});
test('missing provenance is never silently treated as an operator',()=>{
  assert.equal(authorizedCommand('arm gate').ok,false);
  assert.equal(authorizedCommand('status',{source:'operator'}).ok,true);
  const gate=new ActionGate();
  assert.equal(gate.arm().ok,false);
  assert.equal(gate.disarm().ok,false);
  assert.equal(gate.stop().ok,false);
  assert.equal(gate.reset().ok,false);
  assert.equal(gate.activate(true).ok,false);
  assert.equal(gate.armed,false);
  assert.equal(gate.stopped,false);
});
test('denied sensitive inputs survive clearing the visible log',()=>{
  const gate=new ActionGate();
  const denied=authorizedCommand('reset safety',{source:'speech',voiceAuthority:true});
  gate.recordDeniedInput('speech',denied.reason);
  const visibleEvents=[{type:'DENIED'}];visibleEvents.length=0;
  assert.equal(visibleEvents.length,0);
  assert.equal(gate.getAudit().length,1);
  assert.equal(gate.getAudit()[0].event,'input-deny');
});