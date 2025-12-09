import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => {
  const repoName = process.env.GITHUB_REPOSITORY?.split('/').pop()
  const base = process.env.GITHUB_REPOSITORY ? `/${repoName}/` : '/'

  return {
    base,
    plugins: [react()],
  }
})
