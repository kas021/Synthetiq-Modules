'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'sources', 'weebcentral-v2', 'index.js'),
  'utf8',
);
const packagedSource = execFileSync('unzip', [
  '-p', path.join(__dirname, '..', 'modules', 'WeebCentral-4.1.13.zip'), 'index.js',
], { encoding: 'utf8' });

test('packaged JavaScript matches the tested source', () => {
  assert.equal(packagedSource, source);
});

async function chaptersFor(titles) {
  const html = titles.map((title, index) =>
    `<a href="/chapters/test-${index}"><span>${title}</span></a>`,
  ).join('');
  const context = {
    console: { log() {} },
    setTimeout,
    fetchv2: async () => ({
      ok: true,
      status: 200,
      text: async () => html,
      bodyBytes: html.length,
    }),
  };
  vm.runInNewContext(source, context, { filename: 'weebcentral/index.js' });
  return context.extractChapters('test-series');
}

test('hash-labelled chapters retain source order and numeric metadata', async () => {
  const chapters = await chaptersFor(['# 100.1', '# 100', '# 10', '# 2', '# 1', '# 0']);
  assert.deepEqual(Array.from(chapters, (chapter) => chapter.title),
    ['# 100.1', '# 100', '# 10', '# 2', '# 1', '# 0']);
  assert.deepEqual(Array.from(chapters, (chapter) => chapter.number),
    [100.1, 100, 10, 2, 1, 0]);
});

test('chapter and act labels retain numeric metadata', async () => {
  const chapters = await chaptersFor(['Act 12', 'Chap 10', 'Ch. 4.5', 'Chapter 2']);
  assert.deepEqual(Array.from(chapters, (chapter) => chapter.number),
    [12, 10, 4.5, 2]);
});

test('episode and collar labels retain source order and display text', async () => {
  for (const labels of [
    ['Episode 100', 'Episode 10', 'Episode 9'],
    ['Collar 100', 'Collar 10', 'Collar 9'],
  ]) {
    const chapters = await chaptersFor(labels);
    assert.deepEqual(Array.from(chapters, (chapter) => chapter.title),
      labels);
    assert.deepEqual(Array.from(chapters, (chapter) => chapter.number),
      [100, 10, 9]);
  }
});

test('unnumbered and equal-number entries keep the source order', async () => {
  const chapters = await chaptersFor([
    'Special 41', '# 2 - Second', '# 2 - First', 'Special 40', '# 1',
  ]);
  assert.deepEqual(Array.from(chapters, (chapter) => chapter.title), [
    'Special 41', '# 2 - Second', '# 2 - First', 'Special 40', '# 1',
  ]);
});

test('special and volume labels are not presented as ordinary chapters', async () => {
  const chapters = await chaptersFor(['Special 41', 'Special 36', 'Volume 1']);
  assert.deepEqual(Array.from(chapters, (chapter) => chapter.title),
    ['Special 41', 'Special 36', 'Volume 1']);
  assert.ok(Array.from(chapters, (chapter) => chapter.number).every(
    (number) => number === undefined,
  ));
});
