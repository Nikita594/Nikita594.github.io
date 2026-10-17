// Дизайны приложения. Каждый живёт в своём файле стилей src/designs/<id>.css и меняет
// цвета, шрифты, форму карточек и фон через общие «крючки» (классы ui-*), см. base.css.

export type DesignId = 'aurora' | 'paper' | 'pulse' | 'mono'

export interface Design {
  id: DesignId
  name: string
  description: string
  /** always — всегда тёмный; never — всегда светлый; theme — по настройке «Тема». */
  dark: 'always' | 'never' | 'theme'
  /** Цвет строки браузера и строки состояния телефона. */
  themeColor: { light: string; dark: string }
  /** Цвета для превью в настройках. */
  swatch: [string, string, string, string]
}

export const DESIGNS: Design[] = [
  {
    id: 'aurora',
    name: 'Северное сияние',
    description: 'Тёмный, стеклянные карточки и переливы цвета',
    dark: 'always',
    themeColor: { light: '#06060d', dark: '#06060d' },
    swatch: ['#06060d', '#5eead4', '#818cf8', '#e879f9'],
  },
  {
    id: 'paper',
    name: 'Бумажный планер',
    description: 'Тёплая бумага, журнальные шрифты, расписание как в ежедневнике',
    dark: 'never',
    themeColor: { light: '#f2ede3', dark: '#f2ede3' },
    swatch: ['#f2ede3', '#1b1813', '#2337ff', '#ffe066'],
  },
  {
    id: 'pulse',
    name: 'Пульс',
    description: 'Яркие плитки, сочные цвета, большие цифры',
    dark: 'never',
    themeColor: { light: '#eceef2', dark: '#eceef2' },
    swatch: ['#eceef2', '#0f1014', '#c6f36b', '#6b5cff'],
  },
  {
    id: 'mono',
    name: 'Монохром',
    description: 'Чёрное и белое, ничего лишнего — только суть',
    dark: 'theme',
    themeColor: { light: '#ffffff', dark: '#000000' },
    swatch: ['#ffffff', '#000000', '#6b6b6b', '#e5e5e5'],
  },
]

export const DEFAULT_DESIGN: DesignId = 'aurora'

export function getDesign(id: unknown): Design {
  return DESIGNS.find((d) => d.id === id) ?? DESIGNS.find((d) => d.id === DEFAULT_DESIGN)!
}

/** Тёмный ли сейчас экран: у части дизайнов это зашито, у «Монохрома» — по теме. */
export function isDarkMode(design: Design, theme: 'system' | 'light' | 'dark', systemDark: boolean): boolean {
  if (design.dark === 'always') return true
  if (design.dark === 'never') return false
  return theme === 'dark' || (theme === 'system' && systemDark)
}
