import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function renameActiveNote(page: import('@playwright/test').Page, title: string) {
  await page.locator('.document-name-button').click()
  const nameInput = page.getByRole('textbox', { name: 'Document name' })
  await nameInput.fill(title)
  await nameInput.press('Enter')
}

async function expectNoSeriousA11yViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
  expect(serious, serious.map((violation) => `${violation.id}: ${violation.help}`).join('\n')).toEqual([])
}

test('create, tag, search, restore, persist, theme, and export notes', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New document' }).click()
  await renameActiveNote(page, 'Release Notes')
  await expectNoSeriousA11yViolations(page)
  const editor = page.getByRole('textbox', { name: 'Markdown editor' })
  await editor.fill('# Release plan\n\nFirst draft for the launch.')
  const tagInput = page.getByRole('textbox', { name: 'Add a tag' })
  await tagInput.fill('release')
  await tagInput.press('Enter')
  await expect(page.getByRole('button', { name: /release/ }).first()).toBeVisible()
  await page.getByRole('button', { name: /release/ }).first().click()
  await expect(page.getByText('1 of 2 notes')).toBeVisible()
  await page.getByRole('button', { name: 'Version history' }).click()
  await page.getByRole('textbox', { name: 'Version label' }).fill('First draft')
  await page.getByRole('button', { name: 'Save version' }).click()
  await expectNoSeriousA11yViolations(page)
  await page.getByRole('button', { name: 'Close version history' }).click()

  await editor.fill('# Release plan\n\nSecond draft with final copy.')
  await page.keyboard.press('Control+k')
  const search = page.getByRole('combobox', { name: 'Search notes' })
  await search.fill('Release Notes')
  await expectNoSeriousA11yViolations(page)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(editor).toHaveValue(/Second draft/)

  await page.keyboard.press('Control+Alt+h')
  await page.getByRole('button', { name: /First draft/ }).click()
  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(editor).toHaveValue(/First draft for the launch/)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(editor).toHaveValue(/Second draft/)

  await page.getByRole('button', { name: 'Scroll sync on' }).click()
  await expect(page.getByRole('button', { name: 'Scroll sync off' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('markitdown-scrollsync'))).toBe('off')
  await page.getByRole('button', { name: /Theme:/ }).click()
  await expect.poll(() => page.locator('html').getAttribute('data-theme')).toBe('dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('textbox', { name: 'Markdown editor' })).toHaveValue(/Second draft/)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export' }).click()
  await page.getByRole('button', { name: 'Export all as ZIP' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('markitdown-notes.zip')
  const downloadPath = await download.path()
  expect(downloadPath).not.toBeNull()
  const { readFile } = await import('node:fs/promises')
  const { strFromU8, unzipSync } = await import('fflate')
  const entries = unzipSync(new Uint8Array(await readFile(downloadPath!)))
  expect(Object.keys(entries)).toContain('Release Notes.md')
  expect(JSON.parse(strFromU8(entries['manifest.json']!))).toMatchObject({ noteCount: 2, format: 'markitdown-backup' })
})

test('resolve wiki links, show backlinks, and render math and Mermaid lazily', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New document' }).click()
  await renameActiveNote(page, 'Target Page')
  await page.getByRole('textbox', { name: 'Markdown editor' }).fill('# Target Page\n\nThe destination.')

  await page.getByRole('button', { name: 'New document' }).click()
  await renameActiveNote(page, 'Source Page')
  await page.getByRole('textbox', { name: 'Markdown editor' }).fill([
    '[[Target Page|the target]]',
    '',
    'Math: $x^2 + 1$. Price: $5 and $10.',
    '',
    '$$',
    'E = mc^2',
    '$$',
    '',
    '```mermaid',
    'flowchart TD',
    '  A[Start] --> B[Finish]',
    '```',
  ].join('\n'))
  await expect(page.locator('.markdown-body a[data-note-id]')).toContainText('the target')
  await expect(page.locator('.katex').first()).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.mermaid-image')).toBeVisible({ timeout: 30_000 })
  await page.locator('.markdown-body a[data-note-id]').click()
  await expect(page.getByRole('heading', { name: 'Target Page' })).toBeVisible()
  await expect(page.getByText('Source Page', { exact: true }).last()).toBeVisible()
  await expectNoSeriousA11yViolations(page)
})

test('mobile drawer and preview tabs remain usable and accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Toggle notes sidebar' }).click()
  await expect(page.getByRole('complementary', { name: 'Notes library' })).toBeVisible()
  await expectNoSeriousA11yViolations(page)
  await page.getByRole('textbox', { name: 'Markdown editor' }).fill('/mer')
  await expect(page.getByRole('option', { name: /Mermaid diagram/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(page.locator('.preview-panel')).toHaveClass(/mobile-visible/)
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 390)
})