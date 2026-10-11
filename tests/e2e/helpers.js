// Shared helpers for the Logo end-to-end tests.

// Draw instantly, so tests don't wait on the turtle's animation, unless
// the test has chosen another speed.
async function instantDrawing(page) {
  await page.addInitScript(() => {
    try {
      if (!localStorage.getItem('mckoss.logo.speed')) localStorage.setItem('mckoss.logo.speed', 'instant');
    } catch (e) { /* storage blocked */ }
  });
}

// How many pixels of a canvas have been drawn on (not blank or white).
function ink(canvas) {
  return canvas.evaluate(c => {
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] && (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240)) count++;
    }
    return count;
  });
}

module.exports = { instantDrawing, ink };
