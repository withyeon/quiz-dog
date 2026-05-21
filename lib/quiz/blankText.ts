export const BLANK_PLACEHOLDER_DISPLAY = '[            ]'

const BLANK_PLACEHOLDER_PATTERN = /\{\{blank\}\}|\[\s*\]/g

export function displayBlankText(text: string): string {
  return text.replace(BLANK_PLACEHOLDER_PATTERN, BLANK_PLACEHOLDER_DISPLAY)
}

export function splitBlankText(text: string): string[] {
  return text.split(BLANK_PLACEHOLDER_PATTERN)
}
