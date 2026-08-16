// SPDX-License-Identifier: GPL-3.0-only
export type TranslationTable = Record<string, string>
export interface I18nInstance {
  locale: string
  t: (key: string, fallback?: string) => string
}

export const i18nKey = Symbol('winui-i18n')

export function createI18n(
  locale: string,
  resources: Record<string, TranslationTable>
): I18nInstance {
  const selected = resources[locale] ?? resources['en-US'] ?? {}
  return {
    locale: resources[locale] ? locale : 'en-US',
    t: (key, fallback) => selected[key] ?? fallback ?? key
  }
}

export function useI18n(instance?: I18nInstance): I18nInstance {
  return instance ?? createI18n('en-US', { 'en-US': {} })
}

export default createI18n
