import test from 'node:test';
import assert from 'node:assert/strict';
import { ANCHORS, clamp, distance3, virtualPixelDistance, rssiDistance, estimate2D, command, ActionGate } from '../core.mjs';

test('3D Pythagorean measurement',()=>assert.equal(distance3([0,0,0],[1,2,2]),3));
test('2D calibration',()=>assert.equal(virtualPixelDistance({x:0,y:0},{x:100,y:0},500,5),1));
test('RSSI textbook reference distance',()=>assert.equal(rssiDistance(-59),1));
test('trilateration 3 anchors exact',()=>{
  const a=[[0,0],[4,0],[0,3]], p=[1.2,1.8];const r=a.map(q=>Math.hypot(q[0]-p[0],q[1]-p[1]));
  const e=estimate2D(a,r);assert.ok(Math.abs(e[0]-p[0])<1e-9&&Math.abs(e[1]-p[1])<1e-9);
});
test('reject collinear anchors',()=>assert.throws(()=>estimate2D([[0,0],[1,0],[2,0]],[1,2,3]),/Degenerate/));
test('all demo anchors have unique IDs',()=>assert.equal(new Set(ANCHORS.map(a=>a.id)).size,ANCHORS.length));
test('natural commands parse without AI hallucination',()=>{
 assert.deepEqual(command('grid off'),{type:'toggle',key:'grid',value:false});
 assert.equal(command('Please measure the room').type,'measure');
 assert.equal(command('E-STOP!').type,'stop');
 assert.equal(command('focus A1').id,'A1');
});
test('gate blocks unarmed and unconfirmed actions',()=>{
 const g=new ActionGate();assert.equal(g.activate(true).ok,false);g.arm();assert.equal(g.activate(false).ok,false);assert.equal(g.activate(true).ok,true);assert.equal(g.armed,false);
});
test('emergency stop latched',()=>{
 const g=new ActionGate();g.arm();g.stop();assert.equal(g.activate(true).ok,false);assert.equal(g.arm().ok,false);g.reset();assert.equal(g.activate(true).ok,false);
});
test('value clamp',()=>assert.equal(clamp(120,0,100),100));
