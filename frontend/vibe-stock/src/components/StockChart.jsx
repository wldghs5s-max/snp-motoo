import { useEffect, useRef, useState } from 'react'
import { formatCurrency, formatPrice } from '../utils/format'
import { apiFetch } from '../api/client'
import './StockChart.css'

// Resolutions list
const TIMEFRAMES = [
  { label: '1분봉', value: '1', seconds: 6 * 3600 },       // Last 6 hours (360 candles)
  { label: '5분봉', value: '5', seconds: 30 * 3600 },      // Last 30 hours (360 candles)
  { label: '시간봉', value: '60', seconds: 15 * 24 * 3600 }, // Last 15 days (360 candles)
  { label: '일봉', value: 'D', seconds: 365 * 24 * 3600 },  // Last 365 days (~250 trading candles)
]

function StockChart({ symbol, name, currentPrice, isModal = false, exchangeRate = 1350 }) {
  const canvasRef = useRef(null)
  const [resolution, setResolution] = useState('5') // Default: 5 minutes
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // Modal zoom states
  const [showModal, setShowModal] = useState(false)

  // Zoom & Pan states
  const [visibleCount, setVisibleCount] = useState(70) // Number of visible candles
  const [scrollOffset, setScrollOffset] = useState(0) // How many candles scrolled to left (older data)
  const isDraggingRef = useRef(false)
  const dragStartXRef = useRef(0)

  // Helper: Fetch a single latest quote price (REST)
  const fetchQuotePrice = async () => {
    try {
      const data = await apiFetch(`/api/stocks/${symbol}/quote`)
      if (data && data.c) {
        return Math.round(data.c * exchangeRate)
      }
    } catch (e) {
      console.warn('Failed to fetch quote in StockChart', e)
    }
    return null
  }

  // Fetch candles
  useEffect(() => {
    setLoading(true)
    setError(null)
    setChartData([])
    setScrollOffset(0) // Reset scroll on stock/resolution change

    let active = true

    const fetchHistoricalData = async () => {
      try {
        const selectedTimeframe = TIMEFRAMES.find((tf) => tf.value === resolution) || TIMEFRAMES[1]
        const to = Math.floor(Date.now() / 1000)
        const from = to - selectedTimeframe.seconds
        
        const data = await apiFetch(`/api/stocks/${symbol}/candles?resolution=${resolution}&from=${from}&to=${to}`)
        
        if (!active) return

        if (data.s === 'ok' && data.c && data.c.length > 0) {
          const candles = data.c.map((close, idx) => ({
            time: new Date(data.t[idx] * 1000),
            open: Math.round(data.o[idx] * exchangeRate),
            high: Math.round(data.h[idx] * exchangeRate),
            low: Math.round(data.l[idx] * exchangeRate),
            close: Math.round(close * exchangeRate),
            volume: Math.round(data.v[idx]),
          }))
          
          setChartData(candles)
        } else {
          generateMockCandles()
        }
      } catch (err) {
        console.warn('Historical fetch failed, using mock candles:', err)
        if (active) {
          generateMockCandles()
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    fetchHistoricalData()

    const generateMockCandles = async () => {
      const basePrices = {
        AAPL: 450500,
        TSLA: 514100,
        NVDA: 273800,
        MSFT: 531700,
        GOOGL: 229500,
        AMZN: 249750,
        META: 648000,
        NFLX: 823500,
      }
      // Use currentPrice directly as base if available to prevent discrepancy with real-time updates
      let base = currentPrice || basePrices[symbol] || 200000

      if (!currentPrice) {
        const livePrice = await fetchQuotePrice()
        if (livePrice) {
          base = livePrice
        }
      }

      const pointsCount = 300
      const candles = []
      const now = Date.now()
      
      let stepTime = 5 * 60 * 1000
      if (resolution === '1') stepTime = 1 * 60 * 1000
      if (resolution === '60') stepTime = 60 * 60 * 1000
      if (resolution === 'D') stepTime = 24 * 60 * 60 * 1000

      let runningPrice = base

      for (let i = 0; i <= pointsCount; i++) {
        const time = new Date(now - i * stepTime)
        const close = Math.round(runningPrice)
        const fluctuation = (Math.random() - 0.495) * (base * 0.003) // Slight upward bias
        const open = Math.round(runningPrice - fluctuation)
        
        const high = Math.round(Math.max(open, close) + Math.random() * (base * 0.0015))
        const low = Math.round(Math.min(open, close) - Math.random() * (base * 0.0015))
        
        const volume = Math.round(Math.random() * 5000) + 500
        
        candles.unshift({ time, open, high, low, close, volume })
        runningPrice = open
      }

      setChartData(candles)
    }



    return () => {
      active = false
    }
  }, [symbol, resolution])

  // Real-time price feed appender/updater
  useEffect(() => {
    if (!currentPrice || chartData.length === 0) return

    const now = new Date()

    let stepTime = 5 * 60 * 1000
    if (resolution === '1') stepTime = 1 * 60 * 1000
    if (resolution === '60') stepTime = 60 * 60 * 1000
    if (resolution === 'D') stepTime = 24 * 60 * 60 * 1000

    setChartData((prev) => {
      if (prev.length === 0) return prev
      const updated = [...prev]
      const last = { ...updated[updated.length - 1] }

      if ((now - last.time) < stepTime) {
        last.close = currentPrice
        last.high = Math.max(last.high, currentPrice)
        last.low = Math.min(last.low, currentPrice)
        last.volume += 10
        updated[updated.length - 1] = last
      } else {
        const newCandle = {
          time: now,
          open: last.close,
          high: Math.max(last.close, currentPrice),
          low: Math.min(last.close, currentPrice),
          close: currentPrice,
          volume: 100,
        }
        updated.push(newCandle)
        if (updated.length > 365) {
          updated.shift()
        }
      }
      return updated
    })
  }, [currentPrice])

  // Technical Indicators calculations
  const calculateSMA = (data, period) => {
    const sma = []
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        sma.push(null)
      } else {
        let sum = 0
        for (let j = 0; j < period; j++) {
          sum += data[i - j].close
        }
        sma.push(sum / period)
      }
    }
    return sma
  }

  const calculateBollingerBands = (data, period = 20, stdDevMultiplier = 2) => {
    const middle = []
    const upper = []
    const lower = []

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        middle.push(null)
        upper.push(null)
        lower.push(null)
      } else {
        let sum = 0
        for (let j = 0; j < period; j++) {
          sum += data[i - j].close
        }
        const avg = sum / period
        middle.push(avg)

        let varianceSum = 0
        for (let j = 0; j < period; j++) {
          varianceSum += Math.pow(data[i - j].close - avg, 2)
        }
        const stdDev = Math.sqrt(varianceSum / period)

        upper.push(avg + stdDevMultiplier * stdDev)
        lower.push(avg - stdDevMultiplier * stdDev)
      }
    }
    return { middle, upper, lower }
  }

  const calculateRSI = (data, period = 14) => {
    const rsi = []
    if (data.length < period + 1) {
      return Array(data.length).fill(null)
    }

    const gains = []
    const losses = []
    for (let i = 1; i < data.length; i++) {
      const diff = data[i].close - data[i - 1].close
      gains.push(diff > 0 ? diff : 0)
      losses.push(diff < 0 ? -diff : 0)
    }

    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period

    for (let i = 0; i < period; i++) {
      rsi.push(null)
    }

    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    rsi.push(100 - (100 / (1 + rs)))

    for (let i = period + 1; i < data.length; i++) {
      const gain = gains[i - 1]
      const loss = losses[i - 1]

       avgGain = (avgGain * (period - 1) + gain) / period
       avgLoss = (avgLoss * (period - 1) + loss) / period

       rs = avgLoss === 0 ? 100 : avgGain / avgLoss
       rsi.push(100 - (100 / (1 + rs)))
    }

    return rsi
  }

  const sma5 = calculateSMA(chartData, 5)
  const sma20 = calculateSMA(chartData, 20)
  const sma60 = calculateSMA(chartData, 60)
  const sma120 = calculateSMA(chartData, 120)
  const sma240 = calculateSMA(chartData, 240)
  const bb = calculateBollingerBands(chartData, 20, 2)
  const rsi = calculateRSI(chartData, 14)

  // Calculate visible range based on visibleCount and scrollOffset
  const totalPoints = chartData.length
  const endIndex = Math.max(0, totalPoints - scrollOffset)
  const startIndex = Math.max(0, endIndex - visibleCount)

  // Sliced data lists for rendering
  const visibleCandles = chartData.slice(startIndex, endIndex)
  const visibleSma5 = sma5.slice(startIndex, endIndex)
  const visibleSma20 = sma20.slice(startIndex, endIndex)
  const visibleSma60 = sma60.slice(startIndex, endIndex)
  const visibleSma120 = sma120.slice(startIndex, endIndex)
  const visibleSma240 = sma240.slice(startIndex, endIndex)
  const visibleBb = {
    upper: bb.upper.slice(startIndex, endIndex),
    middle: bb.middle.slice(startIndex, endIndex),
    lower: bb.lower.slice(startIndex, endIndex),
  }
  const visibleRsi = rsi.slice(startIndex, endIndex)

  // Dynamic Y-axis scale based ONLY on visible candles
  useEffect(() => {
    if (loading || visibleCandles.length < 2) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height

    const padding = { top: 40, right: 90, bottom: 40, left: 20 }
    const graphWidth = width - padding.left - padding.right
    const graphHeight = height - padding.top - padding.bottom

    const mainHeight = graphHeight * 0.68
    const rsiTop = padding.top + mainHeight + graphHeight * 0.1
    const rsiHeight = graphHeight * 0.22

    // Clear background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    // Calculate Min/Max of price in visible slice
    const highs = visibleCandles.map((d) => d.high)
    const lows = visibleCandles.map((d) => d.low)

    const validBbUpper = visibleBb.upper.filter((v) => v !== null)
    const validBbLower = visibleBb.lower.filter((v) => v !== null)

    let absoluteHigh = Math.max(...highs)
    let absoluteLow = Math.min(...lows)

    if (validBbUpper.length > 0) {
      absoluteHigh = Math.max(absoluteHigh, ...validBbUpper)
      absoluteLow = Math.min(absoluteLow, ...validBbLower)
    }

    const priceDiff = absoluteHigh - absoluteLow || 1
    const yMax = absoluteHigh + priceDiff * 0.05
    const yMin = Math.max(0, absoluteLow - priceDiff * 0.05)
    const yDiff = yMax - yMin

    // Mapping Functions
    const getX = (index) => padding.left + (index / (visibleCandles.length - 1)) * graphWidth
    const getY = (price) => padding.top + mainHeight - ((price - yMin) / yDiff) * mainHeight

    // Draw Grids
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])

    // Draw horizontal grid lines in Price Panel
    for (let i = 0; i <= 4; i++) {
      const yVal = yMin + (yDiff * i) / 4
      const y = getY(yVal)
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(width - padding.right, y)
      ctx.stroke()

      // Price text labels on right
      ctx.setLineDash([])
      ctx.fillStyle = '#4b5563'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(formatPrice(Math.round(yVal)), width - padding.right + 10, y + 4)
      ctx.setLineDash([4, 4])
    }

    // Draw vertical grid lines
    const step = Math.max(1, Math.floor(visibleCandles.length / 5))
    for (let i = 0; i < 5; i++) {
      const idx = Math.min(i * step, visibleCandles.length - 1)
      const x = getX(idx)
      
      // Main panel vertical grid
      ctx.beginPath()
      ctx.moveTo(x, padding.top)
      ctx.lineTo(x, padding.top + mainHeight)
      ctx.stroke()

      // RSI panel vertical grid
      ctx.beginPath()
      ctx.moveTo(x, rsiTop)
      ctx.lineTo(x, rsiTop + rsiHeight)
      ctx.stroke()

      // X Label (Time)
      ctx.setLineDash([])
      ctx.fillStyle = '#4b5563'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'center'
      
      let timeStr = ''
      const timeVal = visibleCandles[idx].time
      if (resolution === 'D') {
        timeStr = timeVal.toLocaleDateString([], { month: '2-digit', day: '2-digit' })
      } else {
        timeStr = timeVal.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
      ctx.fillText(timeStr, x, height - padding.bottom + 20)
      ctx.setLineDash([4, 4])
    }

    ctx.setLineDash([])

    // 1. DRAW BOLLINGER BANDS
    if (visibleBb.upper.some(v => v !== null)) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.05)'
      ctx.beginPath()
      
      const firstValidIdx = visibleBb.upper.findIndex(v => v !== null)
      
      ctx.moveTo(getX(firstValidIdx), getY(visibleBb.upper[firstValidIdx]))
      for (let i = firstValidIdx + 1; i < visibleCandles.length; i++) {
        ctx.lineTo(getX(i), getY(visibleBb.upper[i]))
      }
      for (let i = visibleCandles.length - 1; i >= firstValidIdx; i--) {
        ctx.lineTo(getX(i), getY(visibleBb.lower[i]))
      }
      ctx.closePath()
      ctx.fill()

      ctx.lineWidth = 1.2
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.45)'
      ctx.setLineDash([2, 2])
      
      ctx.beginPath()
      for (let i = firstValidIdx; i < visibleCandles.length; i++) {
        const x = getX(i)
        const y = getY(visibleBb.upper[i])
        if (i === firstValidIdx) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      ctx.beginPath()
      for (let i = firstValidIdx; i < visibleCandles.length; i++) {
        const x = getX(i)
        const y = getY(visibleBb.lower[i])
        if (i === firstValidIdx) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    // 2. DRAW VOLUME BARS (Visible candles)
    const maxVolume = Math.max(...visibleCandles.map(d => d.volume)) || 1
    const volHeightMax = mainHeight * 0.25
    const candleWidth = Math.max(1.2, (graphWidth / visibleCandles.length) * 0.6)

    for (let i = 0; i < visibleCandles.length; i++) {
      const d = visibleCandles[i]
      const isUp = d.close >= d.open
      const volHeight = (d.volume / maxVolume) * volHeightMax
      const x = getX(i)
      const y = padding.top + mainHeight - volHeight

      ctx.fillStyle = isUp ? 'rgba(16, 185, 129, 0.22)' : 'rgba(244, 63, 94, 0.22)'
      ctx.fillRect(x - candleWidth / 2, y, candleWidth, volHeight)
    }

    // 3. DRAW SMAs
    const drawSmaLine = (smaArray, color, lineWidth = 1.2) => {
      if (smaArray.some(v => v !== null)) {
        ctx.strokeStyle = color
        ctx.lineWidth = lineWidth
        ctx.beginPath()
        const firstIdx = smaArray.findIndex(v => v !== null)
        ctx.moveTo(getX(firstIdx), getY(smaArray[firstIdx]))
        for (let i = firstIdx + 1; i < visibleCandles.length; i++) {
          ctx.lineTo(getX(i), getY(smaArray[i]))
        }
        ctx.stroke()
      }
    }

    drawSmaLine(visibleSma5, '#d97706')
    drawSmaLine(visibleSma20, '#7c3aed')
    drawSmaLine(visibleSma60, '#059669', 1.3)
    drawSmaLine(visibleSma120, '#2563eb', 1.4)
    drawSmaLine(visibleSma240, '#ea580c', 1.5)

    // 4. DRAW CANDLESTICKS
    for (let i = 0; i < visibleCandles.length; i++) {
      const d = visibleCandles[i]
      const isUp = d.close >= d.open
      const candleColor = isUp ? '#dc2626' : '#2563eb'

      const x = getX(i)
      const yOpen = getY(d.open)
      const yClose = getY(d.close)
      const yHigh = getY(d.high)
      const yLow = getY(d.low)

      ctx.strokeStyle = candleColor
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(x, yHigh)
      ctx.lineTo(x, yLow)
      ctx.stroke()

      ctx.fillStyle = candleColor
      const bodyHeight = Math.max(1, Math.abs(yClose - yOpen))
      const bodyY = Math.min(yOpen, yClose)
      ctx.fillRect(x - candleWidth / 2, bodyY, candleWidth, bodyHeight)
    }

    // 5. DRAW RSI PANEL
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)'
    ctx.lineWidth = 1
    ctx.strokeRect(padding.left, rsiTop, graphWidth, rsiHeight)

    ctx.setLineDash([3, 3])
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)'
    
    const rsiY50 = rsiTop + rsiHeight * 0.5
    ctx.beginPath()
    ctx.moveTo(padding.left, rsiY50)
    ctx.lineTo(width - padding.right, rsiY50)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(217, 119, 6, 0.18)'
    const rsiY70 = rsiTop + rsiHeight * 0.3
    const rsiY30 = rsiTop + rsiHeight * 0.7

    ctx.beginPath()
    ctx.moveTo(padding.left, rsiY70)
    ctx.lineTo(width - padding.right, rsiY70)
    ctx.moveTo(padding.left, rsiY30)
    ctx.lineTo(width - padding.right, rsiY30)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = '#6b7280'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('70', width - padding.right + 10, rsiY70 + 3)
    ctx.fillText('50', width - padding.right + 10, rsiY50 + 3)
    ctx.fillText('30', width - padding.right + 10, rsiY30 + 3)

    ctx.fillStyle = 'rgba(217, 119, 6, 0.04)'
    ctx.fillRect(padding.left, rsiY70, graphWidth, rsiY30 - rsiY70)

    const getRsiY = (rsiVal) => rsiTop + rsiHeight - (rsiVal / 100) * rsiHeight

    if (visibleRsi.some(v => v !== null)) {
      ctx.strokeStyle = '#d97706'
      ctx.lineWidth = 1.3
      ctx.beginPath()
      const firstIdx = visibleRsi.findIndex(v => v !== null)
      ctx.moveTo(getX(firstIdx), getRsiY(visibleRsi[firstIdx]))
      for (let i = firstIdx + 1; i < visibleCandles.length; i++) {
        ctx.lineTo(getX(i), getRsiY(visibleRsi[i]))
      }
      ctx.stroke()
    }

    // 6. HOVER CROSSHAIRS & DETAILS
    if (hoveredPoint !== null && visibleCandles[hoveredPoint]) {
      const hPoint = visibleCandles[hoveredPoint]
      const hX = getX(hoveredPoint)
      const hY = getY(hPoint.close)

      // Vertical line
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(hX, padding.top)
      ctx.lineTo(hX, rsiTop + rsiHeight)
      ctx.stroke()

      // Horizontal price line
      ctx.beginPath()
      ctx.moveTo(padding.left, hY)
      ctx.lineTo(width - padding.right, hY)
      ctx.stroke()

      // Horizontal RSI line
      const hRsiVal = visibleRsi[hoveredPoint]
      if (hRsiVal !== null) {
        const hRsiY = getRsiY(hRsiVal)
        ctx.beginPath()
        ctx.moveTo(padding.left, hRsiY)
        ctx.lineTo(width - padding.right, hRsiY)
        ctx.stroke()
      }
      ctx.setLineDash([])

      // Circle tags
      ctx.beginPath()
      ctx.arc(hX, hY, 4.5, 0, 2 * Math.PI)
      ctx.fillStyle = hPoint.close >= hPoint.open ? '#dc2626' : '#2563eb'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.fill()
      ctx.stroke()

      if (hRsiVal !== null) {
        const hRsiY = getRsiY(hRsiVal)
        ctx.beginPath()
        ctx.arc(hX, hRsiY, 4, 0, 2 * Math.PI)
        ctx.fillStyle = '#d97706'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#d97706'
        ctx.font = 'bold 9px sans-serif'
        ctx.fillText(hRsiVal.toFixed(1), width - padding.right + 10, hRsiY + 3)
      }

      ctx.fillStyle = '#111827'
      ctx.font = 'bold 9px sans-serif'
      ctx.fillText(formatPrice(hPoint.close), width - padding.right + 10, hY + 3)
    }
  }, [chartData, loading, hoveredPoint, resolution, visibleCount, scrollOffset])

  // Mouse Move on Canvas (Locates corresponding visible candle)
  const handleMouseMove = (e) => {
    if (loading || visibleCandles.length < 2) return

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setMousePos({ x, y })

    const padding = { top: 40, right: 90, bottom: 40, left: 20 }
    const graphWidth = rect.width - padding.left - padding.right

    if (x >= padding.left && x <= rect.width - padding.right) {
      const ratio = (x - padding.left) / graphWidth
      const index = Math.round(ratio * (visibleCandles.length - 1))

      if (index >= 0 && index < visibleCandles.length) {
        setHoveredPoint(index)
      }
    } else {
      setHoveredPoint(null)
    }
  }

  const handleMouseLeave = () => {
    setHoveredPoint(null)
    isDraggingRef.current = false
  }

  // Wheel Zoom Listener (Scroll Wheel modifies visibleCount)
  const handleWheel = (e) => {
    if (loading || chartData.length < 10) return
    e.preventDefault()

    const zoomStep = 5
    let direction = e.deltaY > 0 ? 1 : -1 // 1: zoom out, -1: zoom in

    setVisibleCount((prev) => {
      const next = prev + direction * zoomStep
      // Bound visibleCount between 15 and full data array length
      return Math.max(15, Math.min(next, chartData.length))
    })
  }

  // Bind non-passive wheel event directly to canvas to allow e.preventDefault()
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false })
    }
    return () => {
      if (canvas) {
        canvas.removeEventListener('wheel', handleWheel)
      }
    }
  }, [chartData, loading])

  // Drag Panning Event Handlers
  const handleMouseDown = (e) => {
    if (loading || chartData.length < 10) return
    isDraggingRef.current = true
    dragStartXRef.current = e.clientX
  }

  const handleDragMouseMove = (e) => {
    handleMouseMove(e) // Track hover crosshairs

    if (!isDraggingRef.current || chartData.length === 0) return

    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const padding = { left: 20, right: 90 }
    const graphWidth = rect.width - padding.left - padding.right
    const candleWidth = graphWidth / visibleCount

    const deltaX = e.clientX - dragStartXRef.current

    // If drag distance exceeds half candle width, shift scroll offset
    if (Math.abs(deltaX) >= candleWidth * 0.6) {
      const shiftUnits = Math.round(deltaX / candleWidth)
      
      setScrollOffset((prev) => {
        const next = prev + shiftUnits
        const maxScroll = chartData.length - visibleCount
        return Math.max(0, Math.min(next, maxScroll))
      })
      
      dragStartXRef.current = e.clientX
    }
  }

  const handleMouseUp = () => {
    isDraggingRef.current = false
  }

  // Get active display point values (from visible slice)
  const activeIdx = hoveredPoint !== null ? hoveredPoint : (visibleCandles.length - 1)
  const activeCandle = visibleCandles[activeIdx]

  const activeSma5 = visibleSma5[activeIdx]
  const activeSma20 = visibleSma20[activeIdx]
  const activeSma60 = visibleSma60[activeIdx]
  const activeSma120 = visibleSma120[activeIdx]
  const activeSma240 = visibleSma240[activeIdx]
  const activeBbUpper = visibleBb.upper[activeIdx]
  const activeBbLower = visibleBb.lower[activeIdx]
  const activeRsi = visibleRsi[activeIdx]

  const latestPrice = chartData.length > 0 ? chartData[chartData.length - 1].close : 0
  const firstPrice = chartData.length > 0 ? chartData[0].close : 0
  const priceDiff = latestPrice - firstPrice
  const percentChange = firstPrice ? (priceDiff / firstPrice) * 100 : 0
  const isPositive = priceDiff >= 0

  return (
    <div className={`stock-chart-card ${isModal ? 'stock-chart-card--modal' : ''}`}>
      <div className="stock-chart-card__header">
        <div className="stock-chart-card__title-area">
          <span className="stock-chart-card__symbol">{symbol}</span>
          <span className="stock-chart-card__name">{name}</span>
        </div>

        <div className="timeframe-buttons">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              className={`tf-btn ${resolution === tf.value ? 'tf-btn--active' : ''}`}
              onClick={() => setResolution(tf.value)}
            >
              {tf.label}
            </button>
          ))}
        </div>
        
        <div className="stock-chart-card__actions">
          {/* Zoom Modal Button (Only visible on main chart card) */}
          {!isModal && (
            <button
              className="chart-action-btn zoom-btn"
              onClick={() => setShowModal(true)}
              title="차트 확대 (모달창 열기)"
            >
              🔍 차트 확대
            </button>
          )}
        </div>

        {chartData.length > 0 && (
          <div className="stock-chart-card__price-area">
            <span className="stock-chart-card__price">{formatCurrency(latestPrice)}</span>
            <span className={`stock-chart-card__change ${isPositive ? 'change-up' : 'change-down'}`}>
              {isPositive ? '▲' : '▼'} {formatPrice(Math.abs(priceDiff))}원 ({percentChange.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      {activeCandle && (
        <div className="chart-hud">
          <div className="hud-row price-hud">
            <span className="hud-date">{activeCandle.time.toLocaleDateString()} {activeCandle.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span>시: <strong className={activeCandle.close >= activeCandle.open ? 'up' : 'down'}>{formatPrice(activeCandle.open)}</strong></span>
            <span>고: <strong className="up">{formatPrice(activeCandle.high)}</strong></span>
            <span>저: <strong className="down">{formatPrice(activeCandle.low)}</strong></span>
            <span>종: <strong className={activeCandle.close >= activeCandle.open ? 'up' : 'down'}>{formatPrice(activeCandle.close)}</strong></span>
            <span>거래량: <strong>{activeCandle.volume.toLocaleString()}</strong></span>
          </div>
          
          <div className="hud-row indicator-hud">
            {activeSma5 && <span>이평(5): <strong style={{ color: '#d97706' }}>{formatPrice(Math.round(activeSma5))}</strong></span>}
            {activeSma20 && <span>이평(20): <strong style={{ color: '#7c3aed' }}>{formatPrice(Math.round(activeSma20))}</strong></span>}
            {activeSma60 && <span>이평(60): <strong style={{ color: '#059669' }}>{formatPrice(Math.round(activeSma60))}</strong></span>}
            {activeSma120 && <span>이평(120): <strong style={{ color: '#2563eb' }}>{formatPrice(Math.round(activeSma120))}</strong></span>}
            {activeSma240 && <span>이평(240): <strong style={{ color: '#ea580c' }}>{formatPrice(Math.round(activeSma240))}</strong></span>}
            
            {activeRsi && <span style={{ marginLeft: '12px' }}>RSI(14): <strong style={{ color: '#d97706' }}>{activeRsi.toFixed(1)}</strong></span>}
          </div>

          <div className="hud-row indicator-hud">
            {activeBbUpper && (
              <span>Bollinger Bands(20,2): 
                <strong style={{ color: '#2563eb', marginLeft: '4px' }}>상한 {formatPrice(Math.round(activeBbUpper))}</strong> / 
                <strong style={{ color: '#2563eb', marginLeft: '4px' }}>하한 {formatPrice(Math.round(activeBbLower))}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Interactive canvas wrapper */}
      <div 
        className="stock-chart-card__canvas-container" 
        onMouseMove={handleDragMouseMove} 
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        style={{ cursor: isDraggingRef.current ? 'grabbing' : 'grab' }}
      >
        {loading ? (
          <div className="stock-chart-card__status">차트 데이터 불러오는 중...</div>
        ) : error ? (
          <div className="stock-chart-card__status error">{error}</div>
        ) : null}
        
        <canvas ref={canvasRef} className="stock-chart-card__canvas" />

        {!loading && hoveredPoint !== null && visibleCandles[hoveredPoint] && (
          <div
            className="stock-chart-card__tooltip"
            style={{
              left: `${Math.min(mousePos.x + 15, canvasRef.current?.getBoundingClientRect().width - 150)}px`,
              top: `${Math.min(mousePos.y + 15, canvasRef.current?.getBoundingClientRect().height - 90)}px`,
            }}
          >
            <div className="tooltip-time">
              {visibleCandles[hoveredPoint].time.toLocaleDateString()} {visibleCandles[hoveredPoint].time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="tooltip-price-details">
              <div>시가: {formatPrice(visibleCandles[hoveredPoint].open)}</div>
              <div>고가: {formatPrice(visibleCandles[hoveredPoint].high)}</div>
              <div>저가: {formatPrice(visibleCandles[hoveredPoint].low)}</div>
              <div style={{ fontWeight: 'bold' }}>종가: {formatPrice(visibleCandles[hoveredPoint].close)}</div>
            </div>
          </div>
        )}
      </div>
      
      <div className="stock-chart-card__footer">
        <span className="footer-tag">● 마우스 드래그: 이동 / 휠 스크롤: 확대·축소</span>
        <span className="footer-info">SMA(5,20,60,120,240) / Bollinger Bands(20,2) / RSI(14)</span>
      </div>

      {/* 8. ZOOM MODAL WINDOW OVERLAY */}
      {showModal && (
        <div className="chart-modal-overlay">
          <div className="chart-modal-card">
            <div className="chart-modal-header">
              <h3 className="chart-modal-title">📈 {name} ({symbol}) - 실시간 차트 정밀 확대</h3>
              <span className="modal-help-tip">💡 마우스 휠 스크롤로 확대/축소, 좌우 클릭 드래그로 시점을 이동할 수 있습니다.</span>
              <button className="close-modal-btn" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="chart-modal-body">
              <StockChart symbol={symbol} name={name} currentPrice={currentPrice} isModal={true} exchangeRate={exchangeRate} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StockChart
