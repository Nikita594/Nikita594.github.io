import { describe, expect, it } from 'vitest'
import { DESIGNS, getDesign, isDarkMode } from './designs'

describe('дизайны', () => {
  it('четыре дизайна, по умолчанию — «Северное сияние»', () => {
    expect(DESIGNS.map((d) => d.id)).toEqual(['aurora', 'paper', 'pulse', 'mono'])
    expect(getDesign(undefined).id).toBe('aurora')
    expect(getDesign('нет такого').id).toBe('aurora')
    expect(getDesign('mono').id).toBe('mono')
  })
  it('тёмный режим: сияние всегда тёмное, бумага и пульс — светлые, монохром — по теме', () => {
    expect(isDarkMode(getDesign('aurora'), 'light', false)).toBe(true)
    expect(isDarkMode(getDesign('paper'), 'dark', true)).toBe(false)
    expect(isDarkMode(getDesign('pulse'), 'dark', true)).toBe(false)
    expect(isDarkMode(getDesign('mono'), 'system', true)).toBe(true)
    expect(isDarkMode(getDesign('mono'), 'system', false)).toBe(false)
    expect(isDarkMode(getDesign('mono'), 'dark', false)).toBe(true)
  })
})
