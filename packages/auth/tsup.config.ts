import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "core/index": "src/core/index.ts",
    "nestjs/index": "src/nestjs/index.ts",
    "sveltekit/index": "src/sveltekit/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2023",
  esbuildPlugins: [
    {
      name: "shared-core",
      setup(build) {
        build.onResolve({ filter: /^\.\.\/core\// }, (args) => {
          if (!args.importer.includes("/src/nestjs/")) return;
          return {
            path:
              build.initialOptions.format === "esm"
                ? "../core/index.mjs"
                : "../core/index.js",
            external: true,
          };
        });
      },
    },
  ],
});
