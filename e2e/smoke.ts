import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

import { chromium } from 'playwright'

async function waitFor(url: string, timeoutMs = 45_000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

const env = {
  ...process.env,
  PORT: '5274',
  API_PORT: '5274',
  HERMES_BASE_URL: '',
  HERMES_PROFILE_URLS: '',
  HERMES_REQUIRED: '0',
  MINIMAX_DISABLED: '0',
  MINIMAX_MOCK: '1',
  JUDGE_JURY_DB_PATH: `data/e2e-smoke-${Date.now()}.sqlite`,
}

function killTree(pid: number | undefined): void {
  if (!pid) return
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore' })
    } catch {
      // Process already exited.
    }
    return
  }
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    // Process already exited.
  }
}

const api = spawn(process.execPath, [join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'server/index.ts'], {
  env,
  stdio: 'ignore',
})
const client = spawn(process.execPath, [join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '5273'], {
  env,
  stdio: 'ignore',
})

try {
  await waitFor('http://127.0.0.1:5274/api/health')
  await waitFor('http://127.0.0.1:5273')

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.goto('http://127.0.0.1:5273')
  await page.getByText('Judge & Jury').first().waitFor()
  await page.getByRole('button', { name: /Create matter/i }).click()
  await page.getByRole('button', { name: /Start trial/i }).click()
  await page.getByText(/live court record/i).waitFor()
  await browser.close()
} finally {
  killTree(api.pid)
  killTree(client.pid)
}
