const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../faculty-admin.html'),'utf8');
const js=fs.readFileSync(path.resolve(__dirname,'../faculty-admin.js'),'utf8');
test('the sessional / other tab and its renderer are fully retired from the Dashboard',()=>{
 assert.equal(html.includes('data-tab="sessional"'),false);
 assert.equal(html.includes('id="sessional-view"'),false);
 assert.equal(html.includes('id="aux-body"'),false);
 assert.equal(js.includes('renderSessional'),false);
 assert.equal(js.includes('loadAuxOnce'),false);
});
