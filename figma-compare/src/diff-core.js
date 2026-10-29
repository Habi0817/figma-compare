(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PixelCompare = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function dimensions(width, height) {
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
      throw new TypeError('Canvas width and height must be positive integers.');
    }
  }

  /**
   * Normalize a rectangle in image pixels and intersect it with the canvas.
   * Negative extents are allowed (e.g. dragging from bottom-right to top-left).
   * Fractional edges expand outwards to cover touched pixels; right/bottom edges
   * are exclusive. Returns { x, y, width, height }, or null when empty/invalid.
   * null input means no rectangle, not the full canvas.
   */
  function normalizeRect(rect, width, height) {
    dimensions(width, height);
    if (!rect || !['x', 'y', 'width', 'height'].every(function (key) { return Number.isFinite(rect[key]); })) return null;
    if (rect.width === 0 || rect.height === 0) return null;
    var x1 = Math.max(0, Math.min(width, Math.floor(Math.min(rect.x, rect.x + rect.width))));
    var y1 = Math.max(0, Math.min(height, Math.floor(Math.min(rect.y, rect.y + rect.height))));
    var x2 = Math.max(0, Math.min(width, Math.ceil(Math.max(rect.x, rect.x + rect.width))));
    var y2 = Math.max(0, Math.min(height, Math.ceil(Math.max(rect.y, rect.y + rect.height))));
    return x2 > x1 && y2 > y1 ? { x: x1, y: y1, width: x2 - x1, height: y2 - y1 } : null;
  }

  function imageSize(size, width, height) {
    if (size == null) return { x:0, y:0, width: width, height: height };
    dimensions(size.width, size.height);
    var x = size.x === undefined ? 0 : size.x, y = size.y === undefined ? 0 : size.y;
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x + size.width > width || y + size.height > height) throw new RangeError('Image rectangle cannot exceed the canvas.');
    return { x:x, y:y, width:size.width, height:size.height };
  }

  function validatePixels(pixels, length, label) {
    if (!(pixels instanceof Uint8ClampedArray) || pixels.length !== length) {
      throw new TypeError(label + ' must be a canvas-sized Uint8ClampedArray of RGBA pixels.');
    }
  }

  /**
   * a/b are equally padded RGBA buffers with stride = width * 4.
   * Optional aSize/bSize describe each original image, with optional nonnegative x/y offsets in the padded canvas.
   * Alpha is composited over white before measuring the maximum RGB distance.
   * threshold is a channel distance from 0..255, not a percentage.
   * Region limits eligible pixels; ignores exclude their union inside that region.
   * Missing pixels on exactly one image always differ, even at threshold 255.
   * Padding outside BOTH images is excluded from all statistics.
   */
  function compare(options) {
    if (!options) throw new TypeError('Comparison options are required.');
    var width = options.width, height = options.height;
    dimensions(width, height);
    var count = width * height;
    if (!Number.isSafeInteger(count * 4)) throw new RangeError('Canvas is too large.');
    var a = options.a, b = options.b;
    validatePixels(a, count * 4, 'a');
    validatePixels(b, count * 4, 'b');
    var threshold = options.threshold === undefined ? 16 : options.threshold;
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 255) throw new RangeError('Threshold must be between 0 and 255.');
    var aSize = imageSize(options.aSize, width, height);
    var bSize = imageSize(options.bSize, width, height);
    var region = options.region == null ? { x: 0, y: 0, width: width, height: height } : normalizeRect(options.region, width, height);
    var ignores = options.ignores == null ? [] : options.ignores;
    if (!Array.isArray(ignores)) throw new TypeError('ignores must be an array of rectangles.');
    var mask = ignores.length ? new Uint8Array(count) : null;
    ignores.forEach(function (raw) {
      var rect = normalizeRect(raw, width, height);
      if (!rect) return;
      for (var y = rect.y; y < rect.y + rect.height; y++) {
        mask.fill(1, y * width + rect.x, y * width + rect.x + rect.width);
      }
    });
    var data = new Uint8ClampedArray(count * 4);
    var changed = 0, compared = 0, ignored = 0;
    var minX = width, minY = height, maxX = -1, maxY = -1;

    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var pixel = y * width + x, i = pixel * 4;
        var hasA = x >= aSize.x && y >= aSize.y && x < aSize.x + aSize.width && y < aSize.y + aSize.height;
        var hasB = x >= bSize.x && y >= bSize.y && x < bSize.x + bSize.width && y < bSize.y + bSize.height;
        var alphaA = a[i + 3] / 255, alphaB = b[i + 3] / 255;
        var ar = a[i] * alphaA + 255 * (1 - alphaA);
        var ag = a[i + 1] * alphaA + 255 * (1 - alphaA);
        var ab = a[i + 2] * alphaA + 255 * (1 - alphaA);
        var br = b[i] * alphaB + 255 * (1 - alphaB);
        var bg = b[i + 1] * alphaB + 255 * (1 - alphaB);
        var bb = b[i + 2] * alphaB + 255 * (1 - alphaB);
        var light = hasA ? 0.2126 * ar + 0.7152 * ag + 0.0722 * ab : 0.2126 * br + 0.7152 * bg + 0.0722 * bb;
        var pale = Math.round(light * 0.22 + 255 * 0.78);
        data[i] = data[i + 1] = data[i + 2] = pale;
        data[i + 3] = 255;

        var eligible = (hasA || hasB) && region && x >= region.x && x < region.x + region.width && y >= region.y && y < region.y + region.height;
        if (!eligible) {
          data[i] = data[i + 1] = data[i + 2] = 246;
          continue;
        }
        if (mask && mask[pixel]) {
          ignored++;
          data[i] = 226; data[i + 1] = 230; data[i + 2] = 237;
          continue;
        }
        compared++;
        var differs = hasA !== hasB || Math.max(Math.abs(ar - br), Math.abs(ag - bg), Math.abs(ab - bb)) > threshold;
        if (differs) {
          changed++;
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          data[i] = 236; data[i + 1] = 71; data[i + 2] = 106;
        }
      }
    }
    return {
      data: data,
      changed: changed,
      compared: compared,
      ignored: ignored,
      ratio: compared ? changed / compared : null,
      bounds: changed ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null
    };
  }

  return Object.freeze({ compare: compare, normalizeRect: normalizeRect });
});
