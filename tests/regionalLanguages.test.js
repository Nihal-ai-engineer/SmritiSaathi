import test from 'node:test';
import assert from 'node:assert/strict';
import {regionalLanguages} from '../src/regionalLanguages.ts';
test('project language defaults cover all eight Northeastern states',()=>{
 assert.equal(Object.keys(regionalLanguages).length,8);
 assert.equal(regionalLanguages['Arunachal Pradesh'],'Nyishi');
 assert.equal(regionalLanguages.Assam,'Assamese');
 assert.equal(regionalLanguages.Manipur,'Meitei');
 assert.equal(regionalLanguages.Meghalaya,'Khasi');
 assert.equal(regionalLanguages.Mizoram,'Mizo');
 assert.equal(regionalLanguages.Nagaland,'Nagamese');
 assert.equal(regionalLanguages.Tripura,'Bengali');
 assert.equal(regionalLanguages.Sikkim,'Nepali');
});
