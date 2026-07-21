export function formatCurrency(amount) {
  return `${amount.toLocaleString('ko-KR')}원`
}

export function formatPrice(price) {
  return price.toLocaleString('ko-KR')
}

export function formatFluctuationRate(rate) {
  if (rate > 0) return `+${rate.toFixed(2)}%`
  if (rate < 0) return `${rate.toFixed(2)}%`
  return '0.00%'
}

export function getFluctuationClass(rate) {
  if (rate > 0) return 'fluctuation-up'
  if (rate < 0) return 'fluctuation-down'
  return 'fluctuation-neutral'
}
