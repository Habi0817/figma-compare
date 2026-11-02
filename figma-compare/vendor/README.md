# OpenCV.js 4.13.0

- Source: https://docs.opencv.org/4.13.0/opencv.js
- Upstream license: https://github.com/opencv/opencv/blob/4.13.0/LICENSE
- SHA-256: `63366510248adf3a7eddf3e793dd825404efb7df3749f4d6f8557c7fa4ca8aa0`
- Downloaded: 2026-11-02. Bundle is unmodified and includes its WebAssembly binary as a data URL.
- See `OPENCV-LICENSE.txt` (Apache-2.0).

The runtime is only executed in an ephemeral worker. This Emscripten/Embind build uses dynamic function generation, so the document CSP includes `unsafe-eval` as well as `wasm-unsafe-eval`. No user-provided JavaScript is evaluated. An enterprise policy that blocks compilation can prevent automatic matching; manual comparison remains available. Upgrade deliberately, verify the hash, and run the browser fixtures before shipping.
