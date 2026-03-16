const fs = require("fs");
const path = require("path");

const vectorDir = path.join(__dirname, "assets", "vectors");
const outputFilePath = path.join(__dirname, "svgAssets.js");

const svgs = {};

const files = fs.readdirSync(vectorDir);

files.forEach((file) => {
  if (file.toLowerCase().endsWith(".svg")) {
    const filePath = path.join(vectorDir, file);
    let content = fs.readFileSync(filePath, "utf8");

    // Basic cleanup: remove XML declaration and doctype if present
    content = content
      .replace(/<\?xml.*?\?>/i, "")
      .replace(/<!DOCTYPE.*?>/i, "")
      .trim();

    // Use filename without extension as key, e.g., "clip_apple"
    const name = path.parse(file).name;
    svgs[name] = content;
  }
});

const outputContent = `window.VECTOR_SVGS = ${JSON.stringify(svgs, null, 2)};`;

fs.writeFileSync(outputFilePath, outputContent);
console.log(`Generated svgAssets.js with ${Object.keys(svgs).length} icons.`);
