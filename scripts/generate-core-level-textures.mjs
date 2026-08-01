import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const sourcePath = path.join(root, "src", "lib", "games", "core-level-builder-core.ts");
const outputDirectories = [
  path.join(root, "public", "games", "core", "builder", "textures"),
  path.join(root, "services", "core-fps", "runtime", "level-textures")
];
const source = await readFile(sourcePath, "utf8");
const texturePattern =
  /texture\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"(#[0-9a-fA-F]{6})",\s*"(#[0-9a-fA-F]{6})",\s*"([^"]+)"/g;
const textures = [...source.matchAll(texturePattern)].map((match) => ({
  accent: match[5],
  category: match[3],
  color: match[4],
  displayName: match[2],
  id: match[1],
  pattern: match[6]
}));

if (textures.length < 40) {
  throw new Error(`Expected at least 40 Core builder textures, found ${textures.length}.`);
}

function noisePattern(texture) {
  const dots = Array.from({ length: 70 }, (_, index) => {
    const x = (index * 73 + texture.id.length * 19) % 256;
    const y = (index * 47 + texture.displayName.length * 23) % 256;
    const size = 2 + (index % 7);
    return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${texture.accent}" opacity="${0.08 + (index % 5) * 0.025}"/>`;
  }).join("");
  return dots;
}

function patternMarkup(texture) {
  switch (texture.pattern) {
    case "brick":
      return `
        <path d="M0 64H256M0 128H256M0 192H256" stroke="#05050a" stroke-opacity=".42" stroke-width="7"/>
        <path d="M64 0V64M192 0V64M128 64V128M64 128V192M192 128V192M128 192V256" stroke="#05050a" stroke-opacity=".42" stroke-width="7"/>
        <path d="M8 8H120M136 72H248M8 136H120M136 200H248" stroke="${texture.accent}" stroke-opacity=".25" stroke-width="5"/>`;
    case "circuit":
      return `
        <path d="M0 40H72V88H142V22H256M0 190H54V146H124V226H198V168H256" fill="none" stroke="${texture.accent}" stroke-opacity=".72" stroke-width="7"/>
        <g fill="${texture.accent}"><circle cx="72" cy="40" r="9"/><circle cx="142" cy="88" r="9"/><circle cx="54" cy="190" r="9"/><circle cx="198" cy="226" r="9"/></g>`;
    case "grid":
      return `
        <path d="M0 64H256M0 128H256M0 192H256M64 0V256M128 0V256M192 0V256" stroke="#05050a" stroke-opacity=".46" stroke-width="6"/>
        <path d="M4 4H60V60H4ZM132 132H188V188H132Z" fill="${texture.accent}" opacity=".26"/>`;
    case "panel":
      return `
        <rect x="7" y="7" width="242" height="242" rx="7" fill="none" stroke="#05050a" stroke-opacity=".5" stroke-width="9"/>
        <path d="M24 42H232M24 214H232" stroke="${texture.accent}" stroke-opacity=".38" stroke-width="7"/>
        <g fill="${texture.accent}" opacity=".7"><circle cx="26" cy="26" r="5"/><circle cx="230" cy="26" r="5"/><circle cx="26" cy="230" r="5"/><circle cx="230" cy="230" r="5"/></g>`;
    case "plank":
      return `
        <path d="M0 64H256M0 128H256M0 192H256" stroke="#05050a" stroke-opacity=".46" stroke-width="7"/>
        <path d="M128 0V64M72 64V128M176 128V192M104 192V256" stroke="#05050a" stroke-opacity=".4" stroke-width="6"/>
        <path d="M18 18H110M92 82H230M12 146H156M122 210H242" stroke="${texture.accent}" stroke-opacity=".3" stroke-width="5"/>`;
    case "tile":
      return `
        <path d="M0 64H256M0 128H256M0 192H256M64 0V256M128 0V256M192 0V256" stroke="#05050a" stroke-opacity=".35" stroke-width="5"/>
        <path d="M8 8H56V56H8ZM136 72H184V120H136ZM72 136H120V184H72ZM200 200H248V248H200Z" fill="${texture.accent}" opacity=".2"/>`;
    default:
      return noisePattern(texture);
  }
}

await Promise.all(outputDirectories.map((directory) => mkdir(directory, { recursive: true })));

for (const texture of textures) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <rect width="256" height="256" fill="${texture.color}"/>
      <rect width="256" height="256" fill="url(#shade)"/>
      ${patternMarkup(texture)}
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".1"/>
          <stop offset=".5" stop-color="#ffffff" stop-opacity="0"/>
          <stop offset="1" stop-color="#000000" stop-opacity=".2"/>
        </linearGradient>
      </defs>
    </svg>`;

  const image = await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  await Promise.all(
    outputDirectories.map((directory) =>
      writeFile(path.join(directory, `${texture.id}.png`), image)
    )
  );
}

const manifest = `${JSON.stringify({ generatedAt: new Date().toISOString(), textures }, null, 2)}\n`;
await Promise.all(
  outputDirectories.map((directory) =>
    writeFile(path.join(directory, "manifest.json"), manifest, "utf8")
  )
);

console.log(`Generated ${textures.length} original Core level-builder textures.`);
