import type { IconName } from '../ui/icons'

export interface NavItem {
  route: string
  label: string
  icon: IconName
}

export const TASK_VIEWS: NavItem[] = [
  { route: 'today', label: 'Сегодня', icon: 'sun' },
  { route: 'next7', label: 'Следующие 7 дней', icon: 'days' },
  { route: 'inbox', label: 'Входящие', icon: 'inbox' },
  { route: 'done', label: 'Выполнено', icon: 'done' },
]

export const TOOLS: NavItem[] = [
  { route: 'week', label: 'Неделя', icon: 'week' },
  { route: 'timer', label: 'Таймер', icon: 'timer' },
  { route: 'habits', label: 'Привычки', icon: 'habit' },
  { route: 'matrix', label: 'Матрица', icon: 'matrix' },
]

/** Нижняя панель на телефоне. Последняя кнопка «Ещё» открывает полное меню. */
export const BOTTOM_NAV: NavItem[] = [
  { route: 'today', label: 'Сегодня', icon: 'sun' },
  { route: 'week', label: 'Неделя', icon: 'week' },
  { route: 'timer', label: 'Таймер', icon: 'timer' },
  { route: 'habits', label: 'Привычки', icon: 'habit' },
]
