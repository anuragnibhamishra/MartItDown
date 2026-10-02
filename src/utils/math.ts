const inlineMathPattern = /(?<!\\)\$(?![\s\d])(?:\\.|[^$\\\n])+(?<!\\)\$(?!\d)/u
const blockMathPattern = /(?<!\\)\$\$[\s\S]+?\$\$(?!\$)/u
const fencedMathPattern = /^\s*```(?:math|latex)\s*\n[\s\S]*?^\s*```\s*$/imu

export function containsMath(markdown: string): boolean {
  return inlineMathPattern.test(markdown) || blockMathPattern.test(markdown) || fencedMathPattern.test(markdown)
}

export function protectCurrencyPairs(markdown: string): string {
  let fence: { marker: '`' | '~'; length: number } | null = null
  return markdown.split('\n').map((line) => {
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence.marker && fenceMatch[1].length >= fence.length) fence = null
      return line
    }
    if (fenceMatch) {
      fence = { marker: fenceMatch[1][0] as '`' | '~', length: fenceMatch[1].length }
      return line
    }
    return line.replace(/(`+[^`]*`+)|(\$\d[\d,.]*(?:\s+(?:and|or)\s+\$\d[\d,.]*)+)/gi, (match, inlineCode: string | undefined) =>
      inlineCode ?? match.replace(/\$/g, '\\$'))
  }).join('\n')
}