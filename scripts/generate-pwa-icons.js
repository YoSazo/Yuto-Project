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

await Promise.all(
  sizes.map(async (size) => {
    const out = join(publicDir, `icon-${size}.png`);
    await sharp(mascot).resize(size, size).png().toFile(out);
    console.log(`Generated ${out}`);
  })
);
