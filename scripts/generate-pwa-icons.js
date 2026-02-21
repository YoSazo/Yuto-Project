import sharp from "sharp";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const mascot = join(root, "src/assets/28c11cb437762e8469db46974f467144b8299a8c.png");
const publicDir = join(root, "public");

if (!existsSync(mascot)) {
  console.error("Mascot not found:", mascot);
  process.exit(1);
}

const sizes = [192, 512];
const mascotScale = 0.65; // Mascot fills 65% of frame, leaving space around

await Promise.all(
  sizes.map(async (size) => {
    const out = join(publicDir, `icon-${size}.png`);
    const inner = Math.round(size * mascotScale);
    const offset = Math.round((size - inner) / 2);
    const resizedMascot = await sharp(mascot).resize(inner, inner).toBuffer();
    await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .composite([{ input: resizedMascot, top: offset, left: offset }])
      .png()
      .toFile(out);
    console.log(`Generated ${out}`);
  })
);
