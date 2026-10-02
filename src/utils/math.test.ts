import { describe, expect, it } from 'vitest'
import { containsMath, protectCurrencyPairs } from './math'

describe('math precheck', () => {
  it('detects inline, block, and fenced math', () => {
    expect(containsMath('Value $x^2 + 1$')).toBe(true)
    expect(containsMath('$$\nx^2 + 1\n$$')).toBe(true)
    expect(containsMath('```math\nx^2 + 1\n```')).toBe(true)
  })

  it('does not mistake ordinary currency for math', () => {
    expect(containsMath('It costs $5 and $10 at the door.')).toBe(false)
    expect(containsMath('Price: $5.00')).toBe(false)
    expect(containsMath('An escaped dollar \\$ stays literal.')).toBe(false)
  })

  it('protects currency pairs when another formula activates the math renderer', () => {
    expect(protectCurrencyPairs('Prices $5 and $10, formula $x^2$.'))
      .toBe('Prices \\$5 and \\$10, formula $x^2$.')
    expect(protectCurrencyPairs('`$5 and $10`\n```text\n$5 and $10\n```'))
      .toBe('`$5 and $10`\n```text\n$5 and $10\n```')
  })
})