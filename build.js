const esbuild = require("esbuild");
const copyStaticFiles = require("esbuild-copy-static-files");
const cssModulesPlugin = require("esbuild-css-modules-plugin");

async function build() {
 const ctx = await esbuild
  .context({
    entryPoints: ["src/index.ts"],
    bundle: true,
    outdir: "docs",
    plugins: [
      // copy everything under `src` to `dist`.
      copyStaticFiles({ src: "./static", dest: "./docs" }),
      cssModulesPlugin({}),
    ],
    logLevel: "debug"
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  });

await ctx.watch()
await ctx.serve({ servedir: "./docs", port: 3000 })
 
}

build();