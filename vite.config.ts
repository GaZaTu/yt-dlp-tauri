import { visualizer } from "rollup-plugin-visualizer"
import { defineConfig } from "vite"
import eslint from "vite-plugin-eslint"
import solid from "vite-plugin-solid"

export default defineConfig({
  plugins: [
    eslint(),
    solid({ ssr: true }),
    visualizer({ filename: "dist/stats.html" }) as any,
  ],
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        experimentalMinChunkSize: 512,
      },
    },
  },
})
