// Runs every Logo example from the lesson pages: the same list as the
// playground's Examples folder, read from the built playground host page
// (demo/site/, from npm run hosts).
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { instantDrawing } = require('./helpers');

const html = fs.readFileSync(path.join(__dirname, '../../demo/site/logo/playground/index.html'), 'utf8');
const json = html.match(/<script type="?application\/json"? class="?pg-examples-data"?>([\s\S]*?)<\/script>/)[1];
const lessons = JSON.parse(json);

// Music examples play in real time; a run still going after this long
// without an error counts as a pass.
const RUN_MS = 3000;

test('every lesson has examples', () => {
  expect(lessons.length).toBeGreaterThan(10);
});

for (const lesson of lessons) {
  lesson.examples.forEach((example, index) => {
    test(`${lesson.lesson} / ${example.name}`, async ({ page }) => {
      await instantDrawing(page);
      await page.goto('/logo/playground/');
      const result = await page.evaluate(async ({ lessonName, index, runMs }) => {
        const lessonData = JSON.parse(document.querySelector('.pg-examples-data').textContent)
          .find(l => l.lesson === lessonName);
        const host = document.createElement('div');
        host.style.width = '600px';
        document.body.appendChild(host);
        const stage = LogoStage.create(host);
        const source = LogoStage.program(lessonData.examples, index);
        const finished = await Promise.race([
          stage.run(source).then(() => true),
          new Promise(resolve => setTimeout(() => resolve(false), runMs)),
        ]);
        if (!finished) stage.stop();
        return {
          error: stage.output.classList.contains('logo-error'),
          output: stage.output.textContent,
        };
      }, { lessonName: lesson.lesson, index, runMs: RUN_MS });
      expect(result.error, result.output).toBe(false);
    });
  });
}
