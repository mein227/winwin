import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages 專案站點路徑：https://<user>.github.io/<repo>/
export default defineConfig({
  base: '/winwin/',
  plugins: [react(), tailwindcss()],
})
