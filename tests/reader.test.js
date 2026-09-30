import test from 'node:test';
import assert from 'node:assert/strict';
import {getRenderableHtml} from '../render.js';

test('reader controls retain exact original Markdown and plain text, including fences and whitespace',()=>{
  for(const source of ['  # Heading\r\n\r\n**Bold** & [link](https://example.com)  ','Plain text\nAnother line\n','```md\n# Heading\n```','Text containing </script> safely']){
    const html=getRenderableHtml(source,{backPath:'/old'});
    // An explicit closing script alone is plain text; no raw source can escape its data element.
    const data=JSON.parse(html.match(/id="reader-source">([\s\S]*?)<\/script>/)[1]);
    assert.equal(data.source,source);assert.equal(data.backPath,'/old');
    assert.match(html,/position:sticky/);assert.match(html,/aria-label="Back"/);assert.match(html,/aria-label="Copy source"/);
  }
});
test('authored HTML stays unwrapped, including fragments and fenced HTML',()=>{
  for(const source of ['<!doctype html><html><body>Own UI</body></html>','<div>Own UI</div>','```html\n<section>Own UI</section>\n```']){
    const html=getRenderableHtml(source);assert.doesNotMatch(html,/reader-header|reader-copy|reader-source/);assert.match(html,/Own UI/);
  }
});
