import { useState, useEffect } from 'react'
import Header from './Header'
import StockChart from './StockChart'
import OrderView from './OrderView'
import HoldingsView from './HoldingsView'
import RankingsView from './RankingsView'
import { apiFetch, API_BASE_URL } from '../api/client'
import { stockQuotes } from '../data/stocks'
import {
  formatCurrency,
  formatFluctuationRate,
  formatPrice,
  getFluctuationClass,
  formatTradingValue,
} from '../utils/format'
import './Dashboard.css'


function Dashboard({ username, onLogout }) {
  const [balance, setBalance] = useState(0)
  const [holdings, setHoldings] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(null) // 'deposit' | 'withdraw' | null
  const [amount, setAmount] = useState('')
  const [modalError, setModalError] = useState('')
  const [modalLoading, setModalLoading] = useState(false)

  // Navigation tab state: 'dashboard' | 'order' | 'holdings'
  const [activeTab, setActiveTab] = useState('dashboard')

  // Real-time stock quotes state
  const [liveStocks, setLiveStocks] = useState(stockQuotes)
  const [selectedStockCode, setSelectedStockCode] = useState('AAPL')
  const [exchangeRate, setExchangeRate] = useState(1350)
  const [searchQuery, setSearchQuery] = useState('')
  const [watchlist, setWatchlist] = useState([])
  const [notificationToast, setNotificationToast] = useState(null)

  const showNotificationToast = (message) => {
    setNotificationToast(message)
    // Clear toast after 4.5 seconds
    setTimeout(() => {
      setNotificationToast(null)
    }, 4500)
  }

  // Fetch current user details (balance)
  const fetchUserData = async () => {
    try {
      const data = await apiFetch('/api/user/me')
      setBalance(data.balance)
    } catch (err) {
      console.error('Failed to fetch user data', err)
      onLogout()
    }
  }

  // Fetch actual user holdings from database
  const fetchHoldings = async () => {
    try {
      const data = await apiFetch('/api/trading/holdings')
      setHoldings(data)
    } catch (err) {
      console.error('Failed to fetch holdings', err)
    }
  }

  const fetchExchangeRate = async () => {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD')
      const data = await response.json()
      if (data && data.rates && data.rates.KRW) {
        const rate = Math.round(data.rates.KRW * 100) / 100
        setExchangeRate(rate)
        console.log(`Fetched latest USD to KRW exchange rate: ${rate}`)
        return rate
      }
    } catch (e) {
      console.warn('Failed to fetch exchange rate, using fallback 1350', e)
    }
    return 1350
  }

  const fetchInitialQuotes = async (rateToUse = 1350) => {
    // Only fetch for top major stocks on mount to prevent Finnhub 429 Rate Limit error
    const topStocks = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX', 'AMD', 'JPM']
    try {
      const updated = await Promise.all(
        liveStocks.map(async (stock) => {
          if (!topStocks.includes(stock.code)) return stock

          try {
            const data = await apiFetch(`/api/stocks/${stock.code}/quote`)
            if (data && data.c) {
              const currentPrice = Math.round(data.c * rateToUse)
              const prevClose = Math.round(data.pc * rateToUse)
              const fluctuationRate = ((currentPrice - prevClose) / prevClose) * 100

              // Push to backend
              apiFetch(`/api/trading/tick/${stock.code}`, {
                method: 'POST',
                body: JSON.stringify({ price: currentPrice }),
              }).catch((e) => console.error('Initial tick push failed', e))

              return {
                ...stock,
                currentPrice,
                prevClose,
                fluctuationRate,
              }
            }
          } catch (e) {
            console.warn(`Failed to fetch quote for ${stock.code}`, e)
          }
          return stock
        })
      )
      setLiveStocks(updated)
    } catch (err) {
      console.warn('Failed to fetch initial quotes', err)
    }
  }

  const loadInitialData = async () => {
    setLoading(true)
    const rate = await fetchExchangeRate()
    await Promise.all([fetchUserData(), fetchHoldings()])
    await fetchInitialQuotes(rate)
    setLoading(false)
  }

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('vibe_watchlist')
    if (saved) {
      try {
        setWatchlist(JSON.parse(saved))
      } catch (e) {
        console.error(e)
      }
    } else {
      setWatchlist(['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL'])
    }
  }, [])

  useEffect(() => {
    if (!selectedStockCode) return
    setWatchlist((prev) => {
      const filtered = prev.filter((code) => code !== selectedStockCode)
      const next = [selectedStockCode, ...filtered].slice(0, 5)
      localStorage.setItem('vibe_watchlist', JSON.stringify(next))
      return next
    })
  }, [selectedStockCode])

  // Sync selected stock's quote from API to prevent rate limits and align prices instantly
  useEffect(() => {
    if (loading) return

    const fetchSelectedQuote = async () => {
      try {
        const data = await apiFetch(`/api/stocks/${selectedStockCode}/quote`)
        if (data && data.c) {
          const currentPrice = Math.round(data.c * exchangeRate)
          const prevClose = Math.round(data.pc * exchangeRate)
          const fluctuationRate = ((currentPrice - prevClose) / prevClose) * 100

          setLiveStocks((prev) =>
            prev.map((s) => {
              if (s.code === selectedStockCode) {
                return {
                  ...s,
                  currentPrice,
                  prevClose,
                  fluctuationRate,
                }
              }
              return s
            })
          )

          // Push to backend
          apiFetch(`/api/trading/tick/${selectedStockCode}`, {
            method: 'POST',
            body: JSON.stringify({ price: currentPrice }),
          }).catch((e) => console.error(e))
        }
      } catch (err) {
        console.warn('Failed to fetch selected stock quote', err)
      }
    }

    fetchSelectedQuote()
  }, [selectedStockCode, loading])

  // 5-second interval to fetch balance and holdings, preventing tomcat pool exhaustion
  useEffect(() => {
    if (loading) return
    const interval = setInterval(() => {
      fetchUserData()
      fetchHoldings()
    }, 5000)
    return () => clearInterval(interval)
  }, [loading])

  // Check URL query parameters for KakaoPay result status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    if (payment) {
      if (payment === 'success') {
        showNotificationToast('카카오페이 결제가 완료되어 예수금이 충전되었습니다!')
      } else if (payment === 'cancel') {
        showNotificationToast('카카오페이 결제가 취소되었습니다.')
      } else if (payment === 'fail') {
        showNotificationToast('카카오페이 결제에 실패했습니다.')
      }
      // Clean query params from the URL cleanly
      const newUrl = window.location.pathname + window.location.hash
      window.history.replaceState({}, document.title, newUrl)
    }
  }, [])

  // WebSocket notification connection
  useEffect(() => {
    if (!username) return

    let notifSocket = null
    let reconnectTimeout = null

    const connectNotifSocket = () => {
      let wsBase = ''
      if (API_BASE_URL) {
        wsBase = API_BASE_URL.replace(/^http/, 'ws')
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        wsBase = `${protocol}//${window.location.host}`
      }
      const wsUrl = `${wsBase}/ws/notifications?username=${username}`
      notifSocket = new WebSocket(wsUrl)

      notifSocket.onopen = () => {
        console.log('Real-time notification WebSocket connected')
      }

      notifSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'ORDER_FILLED') {
            // Refresh data immediately
            fetchUserData()
            fetchHoldings()
            // Show toast notification
            showNotificationToast(data.message)
          }
        } catch (e) {
          console.error('Failed to parse notification message', e)
        }
      }

      notifSocket.onclose = () => {
        console.log('Notification WebSocket closed, reconnecting in 3s...')
        reconnectTimeout = setTimeout(connectNotifSocket, 3000)
      }

      notifSocket.onerror = (err) => {
        console.error('Notification WebSocket error', err)
      }
    }

    connectNotifSocket()

    return () => {
      if (notifSocket) notifSocket.close()
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
    }
  }, [username])

  // Top-level real-time data sync loop (WebSocket + Simulation fallback) for all tabs
  useEffect(() => {
    if (loading) return

    let socket = null
    let simulationInterval = null
    let active = true

    const setupWebSocket = () => {
      socket = new WebSocket('wss://ws.finnhub.io?token=d9crpshr01qh8vpjac70d9crpshr01qh8vpjac7g')

      socket.onopen = () => {
        if (socket.readyState === WebSocket.OPEN) {
          // Subscribe only to the top 10 stocks by volume + selected stock to respect rate limits
          const top10Codes = [...liveStocks]
            .sort((a, b) => (b.volume || 0) - (a.volume || 0))
            .slice(0, 10)
            .map(s => s.code);
          
          const subscribeSet = new Set(top10Codes);
          subscribeSet.add(selectedStockCode);

          subscribeSet.forEach((sym) => {
            socket.send(JSON.stringify({ type: 'subscribe', symbol: sym }))
          })
        }
      }

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'trade' && message.data && message.data.length > 0) {
            const latestTrade = message.data[message.data.length - 1]
            const code = latestTrade.s
            const krwPrice = Math.round(latestTrade.p * exchangeRate)
            const tradeVolume = Math.round(latestTrade.v || 10)

            if (active) {
              updateStockPrice(code, krwPrice, tradeVolume)
            }
          }
        } catch (e) {
          console.error('WS parse error', e)
        }
      }
    }

    const updateStockPrice = (code, price, vol = 10) => {
      setLiveStocks((prevStocks) =>
        prevStocks.map((stock) => {
          if (stock.code === code) {
            const prevClose = stock.prevClose || stock.currentPrice
            const fluctuationRate = ((price - prevClose) / prevClose) * 100
            const changeType = price > stock.currentPrice ? 'up' : price < stock.currentPrice ? 'down' : stock.changeType
            return {
              ...stock,
              currentPrice: price,
              fluctuationRate,
              volume: (stock.volume || 0) + vol,
              changeType,
              lastUpdated: Date.now()
            }
          }
          return stock
        })
      )

      // Push price tick to backend ONLY for the active symbol
      apiFetch(`/api/trading/tick/${code}`, {
        method: 'POST',
        body: JSON.stringify({ price }),
      }).catch((err) => console.error('Tick push failed', err))
    }

    // Fallback simulation running at the Dashboard level
    simulationInterval = setInterval(() => {
      if (!active) return

      // Collect active stock codes that require tick synchronization to match backend orders
      const activeTickSymbols = new Set()
      activeTickSymbols.add(selectedStockCode)
      holdings.forEach((h) => activeTickSymbols.add(h.stockCode))

      setLiveStocks((prevStocks) => {
        return prevStocks.map((stock) => {
          const drift = (Math.random() - 0.49) * (stock.currentPrice * 0.0015)
          const nextPrice = Math.round(stock.currentPrice + drift)
          const prevClose = stock.prevClose || stock.currentPrice
          const fluctuationRate = ((nextPrice - prevClose) / prevClose) * 100
          const volIncrease = Math.floor(Math.random() * 8000) + 1000
          const changeType = nextPrice > stock.currentPrice ? 'up' : nextPrice < stock.currentPrice ? 'down' : stock.changeType

          // Push simulation price tick ONLY if it is an active stock (current view or held by user)
          if (activeTickSymbols.has(stock.code)) {
            apiFetch(`/api/trading/tick/${stock.code}`, {
              method: 'POST',
              body: JSON.stringify({ price: nextPrice }),
            }).catch((err) => console.error('Simulation tick failed', err))
          }

          return {
            ...stock,
            currentPrice: nextPrice,
            fluctuationRate,
            volume: (stock.volume || 0) + volIncrease,
            changeType,
            lastUpdated: Date.now()
          }
        })
      })
    }, 2500)

    setupWebSocket()

    return () => {
      active = false
      if (socket) socket.close()
      if (simulationInterval) clearInterval(simulationInterval)
    }
  }, [loading, selectedStockCode])

  const handleOpenModal = (type) => {
    setShowModal(type)
    setAmount('')
    setModalError('')
  }

  const handleCloseModal = () => {
    setShowModal(null)
    setAmount('')
    setModalError('')
  }

  const handleQuickAmount = (val) => {
    const current = Number(amount) || 0
    setAmount(String(current + val))
  }

  const handlePresetAll = () => {
    if (showModal === 'withdraw') {
      setAmount(String(balance))
    }
  }

  const handleTransaction = async (e) => {
    e.preventDefault()
    setModalError('')

    const parsedAmount = Number(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setModalError('금액은 0원보다 커야 합니다.')
      return
    }

    if (showModal === 'withdraw' && parsedAmount > balance) {
      setModalError('잔액이 부족하여 출금할 수 없습니다.')
      return
    }

    setModalLoading(true)

    if (showModal === 'deposit') {
      try {
        const data = await apiFetch('/api/payment/ready', {
          method: 'POST',
          body: JSON.stringify({ amount: parsedAmount }),
        })
        if (data.next_redirect_pc_url) {
          window.location.href = data.next_redirect_pc_url
        } else {
          throw new Error('결제 준비에 실패했습니다.')
        }
      } catch (err) {
        console.error(err)
        setModalError(err.message || '카카오페이 결제 요청 중 오류가 발생했습니다.')
        setModalLoading(false)
      }
      return
    }

    try {
      const data = await apiFetch('/api/user/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: parsedAmount }),
      })

      setBalance(data.balance)
      handleCloseModal()
    } catch (err) {
      console.error(err)
      setModalError(err.message || '요청 처리에 실패했습니다.')
    } finally {
      setModalLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        background: '#f3f4f6',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'sans-serif',
        color: '#4b5563'
      }}>
        자산 정보 로딩 중...
      </div>
    )
  }

  // Calculate actual stock valuation in real-time based on database holdings and websocket price feed
  const stockValuation = holdings.reduce((total, h) => {
    const stock = liveStocks.find((s) => s.code === h.stockCode)
    const currentPrice = stock ? stock.currentPrice : h.averagePrice
    return total + currentPrice * h.quantity
  }, 0)

  // Total valuation updates in real-time with price updates
  const totalValuation = balance + stockValuation

  // Get currently selected stock info
  const selectedStock = liveStocks.find((s) => s.code === selectedStockCode) || liveStocks[0]

  return (
    <div className="dashboard">
      <Header
        username={username}
        onLogout={onLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="dashboard__main">
        {/* Render Tab Contents */}
        {activeTab === 'dashboard' && (
          <>
            <section className="dashboard__section">
              <h1 className="dashboard__heading">모의투자 대시보드</h1>
              <p className="dashboard__description">
                내 자산과 실시간 종목 시세를 한눈에 확인하세요. 종목을 클릭하여 실시간 차트를 볼 수 있습니다.
              </p>
            </section>

            {/* Assets Summary */}
            <section className="dashboard__section">
              <h2 className="dashboard__section-title">내 자산 현황</h2>
              <div className="asset-cards">
                <article className="asset-card">
                  <div className="asset-card__header">
                    <p className="asset-card__label">보유 현금</p>
                    <span className="asset-card__tag">실시간 관리</span>
                  </div>
                  <p className="asset-card__value">
                    {formatCurrency(balance)}
                  </p>
                  <div className="asset-card__actions">
                    <button
                      className="btn-transaction btn-transaction--deposit"
                      onClick={() => handleOpenModal('deposit')}
                    >
                      입금
                    </button>
                    <button
                      className="btn-transaction btn-transaction--withdraw"
                      onClick={() => handleOpenModal('withdraw')}
                    >
                      출금
                    </button>
                  </div>
                </article>
                <article className="asset-card asset-card--highlight">
                  <div className="asset-card__header">
                    <p className="asset-card__label">총 평가 금액</p>
                    <span className="asset-card__tag asset-card__tag--live">실시간 변동</span>
                  </div>
                  <p className="asset-card__value">
                    {formatCurrency(totalValuation)}
                  </p>
                  <div className="asset-card__hint-list">
                    <div className="hint-item">
                      <span>보유 현금:</span> <strong>{formatCurrency(balance)}</strong>
                    </div>
                    <div className="hint-item">
                      <span>주식 평가액:</span> <strong>{formatCurrency(stockValuation)}</strong>
                    </div>
                  </div>
                </article>

                <article className="asset-card">
                  <div className="asset-card__header">
                    <p className="asset-card__label">오늘의 기준 환율</p>
                    <span className="asset-card__tag" style={{ backgroundColor: 'rgba(249, 115, 22, 0.1)', color: 'var(--color-orange)', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>실시간 연동</span>
                  </div>
                  <p className="asset-card__value" style={{ fontSize: '24px', fontWeight: '800', margin: '8px 0' }}>
                    {exchangeRate.toLocaleString()}원
                  </p>
                  <div className="asset-card__hint-list">
                    <div className="hint-item">
                      <span style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '1.4' }}>* 1 USD 기준. 미국 주가 원화 환산에 매일 동적으로 반영됩니다.</span>
                    </div>
                  </div>
                </article>
              </div>
            </section>

            {/* Grid Layout: Quotes + Live Chart */}
            <div className="dashboard__grid">
              <div className="dashboard__grid-left">
                <section className="dashboard__section">
                  <div className="dashboard__section-header">
                    <h2 className="dashboard__section-title">주요 종목 시세</h2>
                    <span className="dashboard__badge dashboard__badge--live">실시간 API</span>
                  </div>

                  {/* Watchlist container */}
                  <div className="watchlist-container" style={{ marginBottom: '16px', textAlign: 'left' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#4b5563', marginRight: '8px' }}>
                      ⭐ 관심종목 (최근 본 종목):
                    </span>
                    <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap' }}>
                      {watchlist.map((code) => {
                        const isSelected = code === selectedStockCode
                        return (
                          <button
                            key={code}
                            onClick={() => setSelectedStockCode(code)}
                            style={{
                              background: isSelected ? '#3b82f6' : '#ffffff',
                              border: isSelected ? '1px solid #3b82f6' : '1px solid #d1d5db',
                              color: isSelected ? '#ffffff' : '#374151',
                              borderRadius: '20px',
                              padding: '4px 12px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            className="watchlist-pill"
                          >
                            {code}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="dashboard-search-panel" style={{ position: 'relative', marginBottom: '16px', textAlign: 'left' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="dashboard-search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="종목명 또는 심볼 검색 (예: GOOGL, META, AMZN)..."
                        style={{
                          width: '100%',
                          padding: '10px 35px 10px 14px',
                          border: '1px solid #d1d5db',
                          borderRadius: '10px',
                          fontSize: '13px',
                          outline: 'none',
                          boxSizing: 'border-box',
                          background: '#ffffff',
                          fontFamily: 'inherit'
                        }}
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            background: 'none',
                            border: 'none',
                            fontSize: '18px',
                            color: '#9ca3af',
                            cursor: 'pointer',
                            padding: 0,
                            lineHeight: 1
                          }}
                        >
                          &times;
                        </button>
                      )}
                    </div>
                    {searchQuery && (
                      <div className="dashboard-search-results" style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '10px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        zIndex: 100,
                        maxHeight: '200px',
                        overflowY: 'auto'
                      }}>
                        {liveStocks
                          .filter((s) =>
                            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            s.code.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .slice(0, 15) // Limit list rendering
                          .map((stock) => (
                            <div
                              key={stock.code}
                              onClick={() => {
                                setSelectedStockCode(stock.code)
                                setSearchQuery('')
                              }}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                padding: '10px 14px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f3f4f6',
                                fontSize: '13px'
                              }}
                              className="search-item-hover"
                            >
                              <span><strong>{stock.code}</strong> - {stock.name}</span>
                              <span style={{ fontWeight: 'bold', color: '#111827' }}>{formatPrice(stock.currentPrice)}원</span>
                            </div>
                          ))
                        }
                        {liveStocks.filter((s) =>
                          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.code.toLowerCase().includes(searchQuery.toLowerCase())
                        ).length === 0 && (
                          <div style={{ padding: '10px 14px', color: '#9ca3af', fontSize: '12px' }}>검색 결과가 없습니다.</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="stock-table-wrapper">
                    <table className="stock-table">
                      <thead>
                        <tr>
                          <th scope="col">종목코드</th>
                          <th scope="col">종목명</th>
                          <th scope="col" className="stock-table__align-right">
                            현재가
                          </th>
                          <th scope="col" className="stock-table__align-right">
                            전일대비
                          </th>
                          <th scope="col" className="stock-table__align-right">
                            거래대금
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...liveStocks]
                          .sort((a, b) => {
                            const valueB = b.currentPrice * (b.volume || 0)
                            const valueA = a.currentPrice * (a.volume || 0)
                            return valueB - valueA
                          })
                          .slice(0, 10)
                          .map((stock) => {
                            const isSelected = stock.code === selectedStockCode
                            const holding = holdings.find((h) => h.stockCode === stock.code)
                            const hasHoldings = holding && holding.quantity > 0

                            const isRecentUpdate = stock.lastUpdated && (Date.now() - stock.lastUpdated < 800)
                            const flashClass = isRecentUpdate 
                              ? (stock.changeType === 'up' ? 'flash-up' : stock.changeType === 'down' ? 'flash-down' : '') 
                              : ''

                            return (
                              <tr
                                key={stock.code}
                                onClick={() => setSelectedStockCode(stock.code)}
                                className={`stock-table__row ${isSelected ? 'stock-table__row--selected' : ''}`}
                              >
                                <td className="stock-table__code">{stock.code}</td>
                                <td className="stock-table__name">
                                  {stock.name}
                                  {hasHoldings && (
                                    <span className="stock-table__holdings-badge">
                                      {holding.quantity}주 보유
                                    </span>
                                  )}
                                </td>
                                <td className={`stock-table__align-right stock-table__price ${flashClass}`}>
                                  {formatPrice(stock.currentPrice)}
                                </td>
                                <td
                                  className={`stock-table__align-right ${getFluctuationClass(stock.fluctuationRate)}`}
                                >
                                  {formatFluctuationRate(stock.fluctuationRate)}
                                </td>
                                <td className="stock-table__align-right stock-table__volume">
                                  {formatTradingValue(stock.currentPrice * (stock.volume || 0))}
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <div className="dashboard__grid-right">
                <section className="dashboard__section">
                  <div className="dashboard__section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h2 className="dashboard__section-title" style={{ marginBottom: 0 }}>실시간 시세 차트</h2>
                    <button
                      onClick={() => setActiveTab('order')}
                      className="btn-go-trade"
                      style={{
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        padding: '8px 16px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)',
                        transition: 'all 0.2s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontFamily: 'inherit'
                      }}
                    >
                      ⚡ {selectedStock.code} 매매하러 가기
                    </button>
                  </div>
                  <StockChart
                    symbol={selectedStock.code}
                    name={selectedStock.name}
                    currentPrice={selectedStock.currentPrice}
                    exchangeRate={exchangeRate}
                  />
                </section>
              </div>
            </div>
          </>
        )}

        {activeTab === 'order' && (
          <>
            <section className="dashboard__section">
              <h1 className="dashboard__heading">주식 주문 / 호가 매수</h1>
              <p className="dashboard__description">
                원하는 호가를 더블 클릭하여 지정가 및 MIT 조건부 주문을 신속하게 거래하세요.
              </p>
            </section>

            <OrderView
              selectedStockCode={selectedStockCode}
              setSelectedStockCode={setSelectedStockCode}
              liveStocks={liveStocks}
              balance={balance}
              onOrderPlaced={() => {
                fetchUserData()
                fetchHoldings()
              }}
            />
          </>
        )}

        {activeTab === 'holdings' && (
          <>
            <section className="dashboard__section">
              <h1 className="dashboard__heading">내 보유 종목</h1>
              <p className="dashboard__description">
                현재 매수 완료된 주식 현황과 평단가 대비 평가 손익률을 실시간으로 확인합니다.
              </p>
            </section>

            <HoldingsView
              liveStocks={liveStocks}
              balance={balance}
              onSelectHolding={(code) => {
                setSelectedStockCode(code)
                setActiveTab('order')
              }}
            />
          </>
        )}

        {activeTab === 'rankings' && (
          <RankingsView currentUsername={username} />
        )}
      </main>

      {/* Transaction Modal (Deposit / Withdraw) */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-card__header">
              <h3 className="modal-card__title">
                {showModal === 'deposit' ? '예수금 입금' : '예수금 출금'}
              </h3>
              <button className="modal-card__close" onClick={handleCloseModal}>&times;</button>
            </div>

            {modalError && (
              <div className="modal-card__error" role="alert">
                {modalError}
              </div>
            )}

            <form onSubmit={handleTransaction} className="modal-form">
              <div className="modal-form__group">
                <label className="modal-form__label">
                  현재 잔액: <strong style={{ color: '#111827' }}>{formatCurrency(balance)}</strong>
                </label>
                <div className="modal-form__input-wrapper">
                  <input
                    type="number"
                    className="modal-form__input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="금액을 입력하세요"
                    min="1"
                    required
                    autoFocus
                  />
                  <span className="modal-form__input-suffix">원</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="modal-presets">
                <button type="button" onClick={() => handleQuickAmount(100000)} className="btn-preset">+10만</button>
                <button type="button" onClick={() => handleQuickAmount(500000)} className="btn-preset">+50만</button>
                <button type="button" onClick={() => handleQuickAmount(1000000)} className="btn-preset">+100만</button>
                <button type="button" onClick={() => handleQuickAmount(5000000)} className="btn-preset">+500만</button>
                {showModal === 'withdraw' && (
                  <button type="button" onClick={handlePresetAll} className="btn-preset btn-preset--all">전액</button>
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-modal btn-modal--cancel"
                  disabled={modalLoading}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className={`btn-modal btn-modal--submit btn-modal--submit-${showModal}`}
                  disabled={modalLoading}
                >
                  {modalLoading ? '처리 중...' : showModal === 'deposit' ? '입금하기' : '출금하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Glowing real-time notification toast */}
      {notificationToast && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 10000,
            background: 'rgba(17, 24, 39, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            maxWidth: '380px',
            animation: 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div style={{ fontSize: '24px' }}>🔔</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#60a5fa' }}>주문 체결 알림</span>
            <span style={{ fontSize: '13px', fontWeight: '600', lineHeight: 1.4 }}>{notificationToast}</span>
          </div>
          <button
            onClick={() => setNotificationToast(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              fontSize: '18px',
              cursor: 'pointer',
              padding: 0,
              marginLeft: 'auto',
              alignSelf: 'flex-start'
            }}
          >
            &times;
          </button>
        </div>
      )}
    </div>
  )
}

export default Dashboard
