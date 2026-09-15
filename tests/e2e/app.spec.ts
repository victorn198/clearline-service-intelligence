import { expect, test } from '@playwright/test'
test('renders, filters, switches language, and fits mobile', async ({ page }) => { test.setTimeout(120000); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await expect(page.locator('.brand')).toContainText('Clearline'); await expect(page.locator('select').first()).toBeEnabled({ timeout: 90000 }); const before=await page.locator('.metric-card strong').first().innerText(); await page.locator('select').first().selectOption('1'); await expect.poll(() => page.locator('.metric-card strong').first().innerText(), { timeout: 90000 }).not.toBe(before); await page.getByRole('button', { name: 'PT' }).click(); await expect(page.getByText('Escopo das evidências')).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true) })

test('shows full history without inventing a prior window', async ({ page }) => {
  test.setTimeout(120000)
  await page.goto('/')
  await page.locator('select').first().selectOption('all')
  await page.locator('.decision-strip:not(.is-loading)').waitFor({ timeout: 90000 })
  await expect(page.locator('.metric-card .delta.neutral').first()).toContainText('no prior window')
})

test('evidence lab exposes five distinct decision lenses', async ({ page }) => {
  test.setTimeout(120000)
  await page.goto('/')
  await expect(page.getByText('How is intake distributed across the observed days?')).toBeVisible({ timeout: 90000 })

  await page.getByRole('tab', { name: 'Volume drivers' }).click()
  await expect(page.getByText('Which products moved intake?')).toBeVisible()

  await page.getByRole('tab', { name: 'Timeliness' }).click()
  await expect(page.getByText('How many exceptions sit behind the rate?')).toBeVisible()

  await page.getByRole('tab', { name: 'Concentration' }).click()
  await expect(page.getByText('Is volume concentrated?')).toBeVisible()

  await page.getByRole('tab', { name: 'SLA scenario' }).click()
  await expect(page.getByText('What if untimely responses decline?')).toBeVisible()
})

test('every secondary page exposes five page-specific lenses', async ({ page }) => {
  test.setTimeout(180000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.locator('select').first().waitFor({ state: 'visible', timeout: 90000 })
  const pages = page.locator('header nav button')
  for (let pageIndex = 1; pageIndex < await pages.count(); pageIndex += 1) {
    await pages.nth(pageIndex).click()
    const lab = page.locator('.evidence-lab')
    await expect(lab).toBeVisible({ timeout: 90000 })
    const tabs = lab.getByRole('tab')
    await expect(tabs).toHaveCount(5)
    const states = new Set<string>()
    for (let tabIndex = 0; tabIndex < 5; tabIndex += 1) {
      await tabs.nth(tabIndex).click()
      await expect(tabs.nth(tabIndex)).toHaveAttribute('aria-selected', 'true')
      states.add(await lab.locator('.evidence-lab-body').innerText())
    }
    expect(states.size).toBe(5)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('each page executes its own metric and trend contract', async ({ page }) => {
  test.setTimeout(180000)
  await page.goto('/')
  await page.locator('select').first().waitFor({ state: 'visible', timeout: 90000 })
  const pages = page.locator('header nav button')
  const metricContracts = new Set<string>()
  const trendContracts = new Set<string>()
  for (let pageIndex = 0; pageIndex < await pages.count(); pageIndex += 1) {
    await pages.nth(pageIndex).click()
    await page.locator('.decision-strip:not(.is-loading)').waitFor({ timeout: 90000 })
    await expect(page.locator('.query-error')).toHaveCount(0)
    metricContracts.add((await page.locator('.metric-label span').allInnerTexts()).join('|'))
    trendContracts.add(`${await page.locator('.stage-head h2').innerText()}|${(await page.locator('.trend-readout strong').allInnerTexts()).join('|')}`)
  }
  expect(metricContracts.size).toBe(await pages.count())
  expect(trendContracts.size).toBe(await pages.count())
})

test('does not show static evidence when the complaint mart cannot load', async ({ page }) => {
  test.setTimeout(120000)
  await page.route('**/data/mart_complaints.parquet', route => route.abort())
  await page.goto('/')
  await expect(page.locator('.query-error')).toBeVisible({ timeout: 90000 })
  await expect(page.locator('.metric-card')).toHaveCount(0)
  await expect(page.locator('.evidence-lab')).toHaveCount(0)
})
test('returns to the top when changing dashboard pages',async({page})=>{
  await page.goto('/')
  await page.locator('.decision-strip:not(.is-loading)').waitFor({timeout:90000})
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight))
  expect(await page.evaluate(()=>window.scrollY)).toBeGreaterThan(0)
  await page.getByRole('button',{name:'Emerging Issues'}).click()
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0)
})
