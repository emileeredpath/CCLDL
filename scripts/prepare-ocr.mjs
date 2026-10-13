import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { mkdir, copyFile, readdir } from "node:fs/promises";
const require = createRequire(import.meta.url);
const output = new URL("../public/ocr/", import.meta.url);
await mkdir(output, { recursive: true });
const engine = dirname(require.resolve("tesseract.js/package.json"));
const core = dirname(require.resolve("tesseract.js-core/package.json"));
const data = dirname(require.resolve("@tesseract.js-data/eng/package.json"));
await copyFile(
  join(engine, "dist/worker.min.js"),
  new URL("worker.min.js", output),
);
for (const name of await readdir(core)) {
  if (name.endsWith("-lstm.wasm") || name.endsWith("-lstm.wasm.js"))
    await copyFile(join(core, name), new URL(name, output));
}
await copyFile(
  join(data, "4.0.0/eng.traineddata.gz"),
  new URL("eng.traineddata.gz", output),
);
console.log(
  "Prepared same-origin OCR worker, WebAssembly engines and English model.",
);
await copyFile(
  join(engine, "LICENSE.md"),
  new URL("LICENSE-tesseract-js.txt", output),
);
await copyFile(
  join(core, "LICENSE"),
  new URL("LICENSE-tesseract-core.txt", output),
);
await copyFile(
  join(data, "README.md"),
  new URL("README-english-model.txt", output),
);
