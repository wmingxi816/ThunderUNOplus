import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const publicDir = resolve(projectRoot, "apps/client-web/public");
const playwrightEntry = resolve(
  projectRoot,
  "node_modules/.pnpm/@playwright+test@1.59.1/node_modules/@playwright/test/index.mjs"
);
const { chromium } = await import(new URL(`file:///${playwrightEntry.replaceAll("\\", "/")}`));

const directFiles = [
  "battle-stage.png",
  "lobby-background.png",
  "turn-clockwise.png",
  "逆时针.png"
];

const directories = ["avatars", "rules"];

async function collectPngFiles() {
  const files = directFiles.map((file) => resolve(publicDir, file));

  for (const directory of directories) {
    const directoryPath = resolve(publicDir, directory);
    const entries = await readdir(directoryPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && extname(entry.name).toLowerCase() === ".png") {
        files.push(resolve(directoryPath, entry.name));
      }
    }
  }

  return files;
}

async function convertAll() {
  const pngFiles = await collectPngFiles();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let totalInputBytes = 0;
  let totalOutputBytes = 0;

  try {
    for (const inputPath of pngFiles) {
      const outputPath = inputPath.replace(/\.png$/i, ".webp");
      const pngBuffer = await readFile(inputPath);
      const converted = await convertPngBufferToWebp(page, pngBuffer, 0.88);

      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, converted);

      const inputSize = pngBuffer.byteLength;
      const outputSize = (await stat(outputPath)).size;

      totalInputBytes += inputSize;
      totalOutputBytes += outputSize;

      console.log(
        `${relativeFromProject(inputPath)} -> ${relativeFromProject(outputPath)} ` +
          `(${formatBytes(inputSize)} -> ${formatBytes(outputSize)})`
      );
    }
  } finally {
    await page.close();
    await browser.close();
  }

  console.log(
    `TOTAL ${formatBytes(totalInputBytes)} -> ${formatBytes(totalOutputBytes)} ` +
      `(${formatPercent(totalOutputBytes / Math.max(totalInputBytes, 1))})`
  );
}

async function removeConvertedPngs() {
  const pngFiles = await collectPngFiles();

  for (const inputPath of pngFiles) {
    const outputPath = inputPath.replace(/\.png$/i, ".webp");
    try {
      await stat(outputPath);
    } catch {
      continue;
    }

    await unlink(inputPath);
    console.log(`removed ${relativeFromProject(inputPath)}`);
  }
}

async function convertPngBufferToWebp(page, pngBuffer, quality) {
  const base64 = pngBuffer.toString("base64");
  const bytes = await page.evaluate(async ({ dataUrl, quality: imageQuality }) => {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Failed to decode PNG image."));
      image.src = dataUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");

    if (context === null) {
      throw new Error("Canvas 2D context is unavailable.");
    }

    context.drawImage(image, 0, 0);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", imageQuality));

    if (blob === null) {
      throw new Error("Failed to encode WebP image.");
    }

    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, { dataUrl: `data:image/png;base64,${base64}`, quality });

  return Buffer.from(bytes);
}

function relativeFromProject(filePath) {
  return filePath.slice(projectRoot.length + 1).replaceAll("\\", "/");
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function formatPercent(ratio) {
  return `${(ratio * 100).toFixed(1)}%`;
}

const mode = process.argv[2] ?? "convert";

if (mode === "convert") {
  await convertAll();
} else if (mode === "cleanup-png") {
  await removeConvertedPngs();
} else {
  throw new Error(`Unknown mode: ${mode}`);
}
