import esbuild from "esbuild"
import copyStaticFiles from "esbuild-copy-static-files"

const ctx = await esbuild
  .context({
    entryPoints: ["src/index.ts"],
    bundle: true,
    outdir: "dist",
    plugins: [
      // copy everything under `src` to `dist`.
      copyStaticFiles({ src: "./static", dest: "./dist" })
    ],
    logLevel: "debug"
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  });

// you can use a CLI flag for this, 
// instead of unconditionally calling `watch` every time.
await ctx.watch()
// same applies to `serve`.
await ctx.serve({ servedir: "./dist", port: 3000 })
