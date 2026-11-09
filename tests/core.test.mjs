import test from 'node:test';
import assert from 'node:assert/strict';
import { ANCHORS, clamp, distance3, virtualPixelDistance, rssiDistance, estimate2D, command, ActionGate, calibrate, calibratedMeters, sigma, convertLength, formatLength } from '../core.mjs';

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
 const g=new ActionGate();assert.equal(g.activate(true,'relay-1',{source:'operator'}).ok,false);g.arm('operator');assert.equal(g.activate(false,'relay-1',{source:'operator'}).ok,false);assert.equal(g.activate(true,'relay-1',{source:'operator'}).ok,true);assert.equal(g.armed,false);
});
test('emergency stop latched',()=>{
 const g=new ActionGate();g.arm('operator');g.stop('operator');assert.equal(g.activate(true,'relay-1',{source:'operator'}).ok,false);assert.equal(g.arm('operator').ok,false);g.reset('operator');assert.equal(g.activate(true,'relay-1',{source:'operator'}).ok,false);
});
test('value clamp',()=>assert.equal(clamp(120,0,100),100));

test('calibrate returns known divided by measured',()=>assert.equal(calibrate(1,1.02),1/1.02));
test('calibration rejects zero, negative and non-finite lengths',()=>{
 for(const pair of [[1,0],[0,1],[-1,1],[1,-1],[1,Infinity],[NaN,1]]) assert.throws(()=>calibrate(...pair),RangeError);
});
test('calibrated meters is separate from authoritative raw distance3',()=>{
 const raw=distance3([0,0,0],[1,0,0]);
 assert.equal(raw,1);
 assert.equal(calibratedMeters(raw,1.1),1.1);
 assert.equal(distance3([0,0,0],[1,0,0]),1);
});
test('sigma uses independent point error formula and calibration scale',()=>{
 assert.ok(Math.abs(sigma(0.02,1.5)-(0.02*Math.sqrt(2)*1.5))<1e-12);
 assert.equal(sigma(0,1),0);
 assert.throws(()=>sigma(-0.1,1),RangeError);
 assert.throws(()=>sigma(0.1,0),RangeError);
});
test('length conversions cover meters, centimeters, millimeters, feet and inches',()=>{
 assert.equal(convertLength(1,'m'),1);
 assert.equal(convertLength(1,'cm'),100);
 assert.equal(convertLength(1,'mm'),1000);
 assert.ok(Math.abs(convertLength(1,'ft')-(1/0.3048))<1e-12);
 assert.ok(Math.abs(convertLength(1,'in')-(1/0.0254))<1e-10);
 assert.equal(formatLength(1,'ft'),'3.28 ft');
 assert.throws(()=>convertLength(1,'yards'),RangeError);
});