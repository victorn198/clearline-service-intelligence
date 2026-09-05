import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './tests/e2e', webServer: { command: 'npm run dev -- --port 4175', port: 4175, reuseExistingServer: true }, use: { baseURL: 'http://127.0.0.1:4175', channel: 'msedge' } })
