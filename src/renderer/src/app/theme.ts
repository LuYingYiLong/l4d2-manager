import type { AppTheme } from "../../../shared/addon-types"

export function applyAppTheme(theme: AppTheme): void {
	document.documentElement.classList.toggle("theme-light", theme === "light")
	document.documentElement.classList.toggle("theme-dark", theme === "dark")
}
