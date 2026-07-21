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

export function formatTradingValue(value) {
  if (!value) return '0원'
  if (value >= 1000000000000) {
    const jo = Math.floor(value / 1000000000000)
    const eok = Math.floor((value % 1000000000000) / 100000000)
    return `${jo}조 ${eok > 0 ? `${eok}억` : ''}`
  }
  if (value >= 100000000) {
    return `${Math.floor(value / 100000000)}억원`
  }
  return `${Math.floor(value / 10000)}만원`
}
