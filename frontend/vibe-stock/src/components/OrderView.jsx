import { useState, useEffect, useRef } from 'react'
import { apiFetch } from '../api/client'
import { formatCurrency, formatPrice } from '../utils/format'
import './OrderView.css'

// Tick sizes per stock
const TICK_SIZES = {
  AAPL: 500,
  TSLA: 500,
  NVDA: 2000,
  MSFT: 1000,
}

function OrderView({ selectedStockCode, setSelectedStockCode, liveStocks, balance, onOrderPlaced }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [orderSide, setOrderSide] = useState('BUY') // 'BUY' | 'SELL'
  const [orderType, setOrderType] = useState('LIMIT') // 'LIMIT' | 'MARKET' | 'MIT'
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [pendingOrders, setPendingOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [watchlist, setWatchlist] = useState([])

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
  }, [selectedStockCode])

  const scrollContainerRef = useRef(null)

  // Find currently selected stock in liveQuotes
  const selectedStock = liveStocks.find((s) => s.code === selectedStockCode) || liveStocks[0]
  const currentPrice = selectedStock ? selectedStock.currentPrice : 200000
  const tickSize = TICK_SIZES[selectedStock?.code] || 500

  // Fetch pending orders
  const fetchPendingOrders = async () => {
    try {
      const data = await apiFetch('/api/trading/orders/pending')
      setPendingOrders(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingOrders(false)
    }
  }

  useEffect(() => {
    fetchPendingOrders()
  }, [])

  // Auto-scroll to center (current price) on stock change
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current
      // Center scroll position
      container.scrollTop = (container.scrollHeight - container.clientHeight) / 2
    }
    // Set price input to current price initially
    setPrice(String(currentPrice))
    setError('')
    setSuccess('')
  }, [selectedStockCode])

  // If market order, force price input to equal current price
  useEffect(() => {
    if (orderType === 'MARKET') {
      setPrice(String(currentPrice))
    }
  }, [orderType, currentPrice])

  // Filter stocks based on search query
  const filteredStocks = liveStocks.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code.includes(searchQuery)
  )

  // Place order
  const handlePlaceOrder = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const parsedQty = Number(quantity)
    const parsedPrice = Number(price)

    if (isNaN(parsedQty) || parsedQty <= 0) {
      setError('수량은 1주 이상이어야 합니다.')
      return
    }

    if (orderType !== 'MARKET' && (isNaN(parsedPrice) || parsedPrice <= 0)) {
      setError('올바른 가격을 입력해 주세요.')
      return
    }

    setSubmitting(true)

    try {
      const response = await apiFetch('/api/trading/order', {
        method: 'POST',
        body: JSON.stringify({
          stockCode: selectedStock.code,
          type: orderSide,
          orderType: orderType,
          price: orderType === 'MARKET' ? currentPrice : parsedPrice,
          quantity: parsedQty,
        }),
      })

      setSuccess(
        orderType === 'MARKET'
          ? `시장가 주문이 즉시 체결되었습니다!`
          : `주문이 정상적으로 등록되었습니다.`
      )
      setQuantity('')
      fetchPendingOrders()
      if (onOrderPlaced) {
        onOrderPlaced() // Notify parent to refresh balance / holdings
      }
    } catch (err) {
      setError(err.message || '주문 등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  // Cancel order
  const handleCancelOrder = async (orderId) => {
    setError('')
    setSuccess('')
    try {
      await apiFetch(`/api/trading/order/${orderId}`, {
        method: 'DELETE',
      })
      setSuccess('주문이 취소되었습니다.')
      fetchPendingOrders()
      if (onOrderPlaced) {
        onOrderPlaced()
      }
    } catch (err) {
      setError(err.message || '주문 취소에 실패했습니다.')
    }
  }

  // Handle double click on order book row
  const handleRowDoubleClick = (rowPrice) => {
    if (orderType !== 'MARKET') {
      setPrice(String(rowPrice))
      setSuccess(`가격이 ${formatPrice(rowPrice)}원으로 입력되었습니다.`)
    }
  }

  // Generate 101 ticks centered around current price
  // 50 above, 1 middle (current price), 50 below
  const generateOrderBookRows = () => {
    const rows = []

    // 50 Ask (Sell) Ticks (Descending from top)
    for (let i = 50; i >= 1; i--) {
      const rowPrice = currentPrice + i * tickSize
      // Pseudo-random ask quantity
      const seed = (selectedStock.code.charCodeAt(0) + i) % 10
      const askQty = Math.round((Math.sin(i * 0.5) + 1.5) * 450) + (seed * 80)
      rows.push({ price: rowPrice, askQty, bidQty: null, type: 'ask' })
    }

    // Current Price row
    rows.push({ price: currentPrice, askQty: null, bidQty: null, type: 'current' })

    // 50 Bid (Buy) Ticks (Descending from current)
    for (let i = 1; i <= 50; i++) {
      const rowPrice = currentPrice - i * tickSize
      if (rowPrice <= 0) continue // Prevent negative price ticks
      const seed = (selectedStock.code.charCodeAt(1) + i) % 10
      const bidQty = Math.round((Math.cos(i * 0.5) + 1.5) * 480) + (seed * 90)
      rows.push({ price: rowPrice, askQty: null, bidQty, type: 'bid' })
    }

    return rows
  }

  const orderBookRows = generateOrderBookRows()

  return (
    <div className="order-view">
      {/* Left Column: Search + Order Book */}
      <div className="order-view__left-col">
        {/* Stock Search Panel */}
        <div className="stock-search-panel">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="종목코드 또는 종목명 검색..."
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery('')}>&times;</button>
            )}
          </div>

          {searchQuery && (
            <div className="search-results-overlay">
              {filteredStocks.length > 0 ? (
                filteredStocks.map((stock) => (
                  <div
                    key={stock.code}
                    className="search-result-item"
                    onClick={() => {
                      setSelectedStockCode(stock.code)
                      setSearchQuery('')
                    }}
                  >
                    <span className="search-result-code">{stock.code}</span>
                    <span className="search-result-name">{stock.name}</span>
                    <span className="search-result-price">{formatPrice(stock.currentPrice)}원</span>
                  </div>
                ))
              ) : (
                <div className="search-result-empty">검색 결과가 없습니다.</div>
              )}
            </div>
          )}
        </div>

        {/* Watchlist pills */}
        <div className="order-watchlist" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', textAlign: 'left' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280' }}>⭐ 관심종목:</span>
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
                  borderRadius: '12px',
                  padding: '3px 10px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {code}
              </button>
            )
          })}
        </div>

        {/* Scrollable Order Book (호가창) */}
        <div className="order-book-container">
          <div className="order-book-header">
            <div className="header-cell ask-title">매도잔량</div>
            <div className="header-cell price-title">호가 ({selectedStock.name})</div>
            <div className="header-cell bid-title">매수잔량</div>
          </div>

          <div className="order-book-scroll" ref={scrollContainerRef}>
            <table className="order-book-table">
              <tbody>
                {orderBookRows.map((row) => {
                  const isCurrent = row.type === 'current'
                  const isAsk = row.type === 'ask'
                  const isBid = row.type === 'bid'

                  return (
                    <tr
                      key={row.price}
                      onDoubleClick={() => handleRowDoubleClick(row.price)}
                      className={`order-book-row ${isCurrent ? 'row-current' : ''}`}
                    >
                      {/* Ask Qty */}
                      <td className="cell ask-qty">
                        {isAsk && (
                          <div className="bar-wrapper">
                            <span className="qty-value">{row.askQty.toLocaleString()}</span>
                            <div
                              className="qty-bar ask-bar"
                              style={{ width: `${Math.min((row.askQty / 3000) * 100, 100)}%` }}
                            ></div>
                          </div>
                        )}
                      </td>

                      {/* Price (Double clickable) */}
                      <td className={`cell price-value ${isCurrent ? 'price-current' : isAsk ? 'price-ask' : 'price-bid'}`}>
                        {formatPrice(row.price)}
                        {isCurrent && <span className="current-indicator">◀</span>}
                      </td>

                      {/* Bid Qty */}
                      <td className="cell bid-qty">
                        {isBid && (
                          <div className="bar-wrapper bid-bar-wrapper">
                            <div
                              className="qty-bar bid-bar"
                              style={{ width: `${Math.min((row.bidQty / 3000) * 100, 100)}%` }}
                            ></div>
                            <span className="qty-value">{row.bidQty.toLocaleString()}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="order-book-tip">💡 호가를 더블 클릭하면 주문 가격이 자동 입력됩니다.</div>
        </div>
      </div>

      {/* Right Column: Order Form + Pending List */}
      <div className="order-view__right-col">
        {/* Order Form */}
        <div className="order-form-card">
          <h3 className="order-form-title">
            <span className={`side-badge side-badge--${orderSide}`}>
              {orderSide === 'BUY' ? '매수' : '매도'}
            </span>
            {selectedStock.name} ({selectedStock.code})
          </h3>

          {error && <div className="order-message error-message">{error}</div>}
          {success && <div className="order-message success-message">{success}</div>}

          <form onSubmit={handlePlaceOrder} className="order-form">
            {/* Side Selector (Buy vs Sell) */}
            <div className="form-toggle-buttons">
              <button
                type="button"
                className={`toggle-btn toggle-btn--buy ${orderSide === 'BUY' ? 'active' : ''}`}
                onClick={() => setOrderSide('BUY')}
              >
                매수
              </button>
              <button
                type="button"
                className={`toggle-btn toggle-btn--sell ${orderSide === 'SELL' ? 'active' : ''}`}
                onClick={() => setOrderSide('SELL')}
              >
                매도
              </button>
            </div>

            {/* Order Type Selector */}
            <div className="form-group">
              <label className="form-label">주문 종류</label>
              <div className="type-buttons">
                <button
                  type="button"
                  className={`type-btn ${orderType === 'LIMIT' ? 'active' : ''}`}
                  onClick={() => setOrderType('LIMIT')}
                >
                  지정가
                </button>
                <button
                  type="button"
                  className={`type-btn ${orderType === 'MARKET' ? 'active' : ''}`}
                  onClick={() => setOrderType('MARKET')}
                >
                  시장가
                </button>
                <button
                  type="button"
                  className={`type-btn ${orderType === 'MIT' ? 'active' : ''}`}
                  onClick={() => setOrderType('MIT')}
                >
                  감시가 (MIT)
                </button>
              </div>
            </div>

            {/* Price Input (Hidden for Market order, customized label for MIT) */}
            {orderType !== 'MARKET' && (
              <div className="form-group">
                <label className="form-label">
                  {orderType === 'MIT' ? '감시 가격 (Trigger)' : '주문 가격'}
                </label>
                <div className="price-input-wrapper">
                  <input
                    type="number"
                    className="form-input price-input"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder={orderType === 'MIT' ? '감시 가격을 입력하세요' : '주문 가격을 입력하세요'}
                    required
                  />
                  <span className="input-suffix">원</span>
                </div>
              </div>
            )}

            {orderType === 'MARKET' && (
              <div className="form-group">
                <label className="form-label">체결 예정가</label>
                <div className="price-market-display">
                  <strong>{formatPrice(currentPrice)}원</strong>
                  <span className="market-tag">시장가 체결</span>
                </div>
              </div>
            )}

            {/* Quantity Input */}
            <div className="form-group">
              <label className="form-label">주문 수량</label>
              <div className="qty-input-wrapper">
                <input
                  type="number"
                  className="form-input qty-input"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="수량을 입력하세요"
                  min="1"
                  required
                />
                <span className="input-suffix">주</span>
              </div>
            </div>

            {/* Estimated Total */}
            <div className="estimated-total">
              <span className="estimated-label">예상 총 금액</span>
              <span className="estimated-value">
                {formatCurrency((Number(price) || currentPrice) * (Number(quantity) || 0))}
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className={`order-submit-btn submit-btn--${orderSide}`}
              disabled={submitting}
            >
              {submitting
                ? '주문 전송 중...'
                : orderSide === 'BUY'
                ? `${orderType === 'MARKET' ? '시장가 매수' : '매수 주문 등록'}`
                : `${orderType === 'MARKET' ? '시장가 매도' : '매도 주문 등록'}`}
            </button>
          </form>
        </div>

        {/* Pending Orders List */}
        <div className="pending-orders-card">
          <h4 className="pending-title">미체결 대기주문</h4>
          <div className="pending-table-wrapper">
            {loadingOrders ? (
              <div className="pending-status">대기주문 불러오는 중...</div>
            ) : pendingOrders.length > 0 ? (
              <table className="pending-table">
                <thead>
                  <tr>
                    <th>종목</th>
                    <th>구분</th>
                    <th>종류</th>
                    <th className="align-right">가격</th>
                    <th className="align-right">수량</th>
                    <th className="align-center">취소</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOrders.map((order) => {
                    const stock = liveStocks.find((s) => s.code === order.stockCode)
                    return (
                      <tr key={order.id}>
                        <td>
                          <strong>{stock ? stock.name.split(' ')[0] : order.stockCode}</strong>
                        </td>
                        <td>
                          <span className={`side-txt side-txt--${order.type}`}>
                            {order.type === 'BUY' ? '매수' : '매도'}
                          </span>
                        </td>
                        <td>
                          <span className="type-txt">{order.orderType}</span>
                        </td>
                        <td className="align-right">{formatPrice(order.price)}</td>
                        <td className="align-right">{order.quantity}주</td>
                        <td className="align-center">
                          <button
                            className="btn-cancel-order"
                            onClick={() => handleCancelOrder(order.id)}
                          >
                            취소
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="pending-empty">대기 중인 주문이 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrderView
