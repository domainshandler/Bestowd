import { defineConfig } from 'vitest/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv(filePath: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(filePath, 'utf8')
        .split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .map(line => {
          const idx = line.indexOf('=')
          return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()]
        })
    )
  } catch {
    return {}
  }
}

const envVars = loadEnv(resolve(import.meta.dirname, '.env'))

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    poolOptions: {
      forks: { singleFork: true }
    },
    env: envVars,
  }
})
