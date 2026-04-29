import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { Resvg } = await import("@resvg/resvg-js");

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const svg = readFileSync(join(dir, "icon.svg"));

function renderPng(size, outName) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
  });
  writeFileSync(join(dir, outName), resvg.render().asPng());
  console.log("wrote", outName, size);
}

renderPng(32, "icon-light-32x32.png");
renderPng(32, "icon-dark-32x32.png");
renderPng(192, "icon-192x192.png");
renderPng(512, "icon-512x512.png");
renderPng(180, "apple-icon.png");
