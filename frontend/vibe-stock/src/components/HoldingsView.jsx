import { useState, useEffect } from 'react'
import { apiFetch } from '../api/client'
import { formatCurrency, formatFluctuationRate, getFluctuationClass } from '../utils/format'
import './HoldingsView.css'

function HoldingsView({ liveStocks, balance, onSelectHolding }) {
  const [holdings, setHoldings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Transaction history state
  const [showHistory, setShowHistory] = useState(false)
  const [historyList, setHistoryList] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Filtering & Paging state
  const [filterStock, setFilterStock] = useState('')
  const [filterSide, setFilterSide] = useState('ALL') // 'ALL' | 'BUY' | 'SELL'
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  const fetchHoldings = async () => {
    try {
      const data = await apiFetch('/api/trading/holdings')
      setHoldings(data)
    } catch (err) {
      console.error(err)
      setError('보유 주식 목록을 가져오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const fetchHistory = async () => {
    setHistoryLoading(true)
    try {
      const data = await apiFetch('/api/trading/history')
      setHistoryList(data)
    } catch (err) {
      console.error('Failed to fetch transaction history', err)
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    fetchHoldings()
  }, [])

  useEffect(() => {
    if (showHistory) {
      fetchHistory()
    }
  }, [showHistory])

  // Reset page when any filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filterStock, filterSide, filterStartDate, filterEndDate])

  // Calculate totals
  let totalCost = 0
  let totalValuation = 0

  const detailedHoldings = holdings.map((h) => {
    const stock = liveStocks.find((s) => s.code === h.stockCode)
    const currentPrice = stock ? stock.currentPrice : h.averagePrice
    const name = stock ? stock.name : h.stockCode
    
    const cost = h.averagePrice * h.quantity
    const valuation = currentPrice * h.quantity
    const profit = valuation - cost
    const returnRate = h.averagePrice > 0 ? (profit / cost) * 100 : 0

    totalCost += cost
    totalValuation += valuation

    return {
      ...h,
      name,
      currentPrice,
      cost,
      valuation,
      profit,
      returnRate,
    }
  })

  const totalProfit = totalValuation - totalCost
  const totalReturnRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0
  const totalAssets = totalValuation + (balance || 0)

  // Collect data slices for Donut Chart
  const slices = []
  if ((balance || 0) > 0) {
    slices.push({ label: '현금(예수금)', value: balance, color: '#10b981' })
  }
  detailedHoldings.forEach((h, idx) => {
    if (h.valuation > 0) {
      const colors = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e']
      const color = colors[idx % colors.length]
      slices.push({ label: h.stockCode, value: h.valuation, color })
    }
  })

  // Render Donut Chart dynamically using native HTML5 Canvas
  useEffect(() => {
    if (loading) return
    const canvas = document.getElementById('donutChartCanvas')
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (totalAssets === 0) {
      ctx.beginPath()
      ctx.arc(110, 110, 75, 0, 2 * Math.PI)
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = 20
      ctx.stroke()
      return
    }

    let startAngle = -Math.PI / 2
    slices.forEach((slice) => {
      const sliceAngle = (slice.value / totalAssets) * (2 * Math.PI)
      ctx.beginPath()
      ctx.arc(110, 110, 75, startAngle, startAngle + sliceAngle)
      ctx.strokeStyle = slice.color
      ctx.lineWidth = 20
      ctx.stroke()
      startAngle += sliceAngle
    })

    // Inner label total asset
    ctx.fillStyle = '#6b7280'
    ctx.font = '500 12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('총 자산 평가액', 110, 98)

    ctx.fillStyle = '#111827'
    ctx.font = 'bold 15px sans-serif'
    ctx.fillText(totalAssets.toLocaleString() + '원', 110, 122)
  }, [detailedHoldings, balance, loading, totalAssets])

  // Filter history list
  const filteredHistory = historyList.filter((item) => {
    if (filterStock && !item.stockCode.toLowerCase().includes(filterStock.toLowerCase())) {
      return false
    }
    if (filterSide !== 'ALL' && item.type !== filterSide) {
      return false
    }
    if (filterStartDate) {
      const start = new Date(filterStartDate + 'T00:00:00')
      const itemDate = new Date(item.createdAt)
      if (itemDate < start) return false
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate + 'T23:59:59')
      const itemDate = new Date(item.createdAt)
      if (itemDate > end) return false
    }
    return true
  })

  // Paginated history list
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1
  const pagedHistory = filteredHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  if (loading) {
    return <div className="holdings-loading">보유 주식 데이터 불러오는 중...</div>
  }

  return (
    <div className="holdings-view">
      {error && <div className="holdings-error">{error}</div>}

      {/* Portfolio Assets Flex Container */}
      <div className="portfolio-assets-row" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', width: '100%' }}>
        {/* Left: Summary totals */}
        <div className="portfolio-summary-card" style={{ flex: '2', minWidth: '320px' }}>
          <h3 className="summary-title">보유 주식 요약</h3>
          
          <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px 20px' }}>
            <div className="summary-item" style={{ borderLeft: 'none', paddingLeft: 0 }}>
              <span className="summary-label">총 매수 금액</span>
              <span className="summary-val">{formatCurrency(totalCost)}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">총 평가 금액</span>
              <span className="summary-val">{formatCurrency(totalValuation)}</span>
            </div>
            <div className="summary-item" style={{ borderLeft: 'none', paddingLeft: 0 }}>
              <span className="summary-label">평가 손익</span>
              <span className={`summary-val ${totalProfit > 0 ? 'fluctuation-up' : totalProfit < 0 ? 'fluctuation-down' : ''}`}>
                {totalProfit > 0 ? '+' : ''}{formatCurrency(totalProfit)}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">총 수익률</span>
              <span className={`summary-val summary-val--percentage ${totalProfit > 0 ? 'fluctuation-up' : totalProfit < 0 ? 'fluctuation-down' : ''}`}>
                {formatFluctuationRate(totalReturnRate)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Donut Chart Visualization */}
        <div className="portfolio-summary-card" style={{ flex: '1', minWidth: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h3 className="summary-title" style={{ width: '100%', textAlign: 'left', marginBottom: '16px' }}>자산 비중 포트폴리오</h3>
          <div style={{ position: 'relative', width: '220px', height: '220px' }}>
            <canvas id="donutChartCanvas" width="220" height="220"></canvas>
          </div>
          
          {/* Chart Legends */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', justifyContent: 'center', marginTop: '16px', maxWidth: '100%' }}>
            {slices.map((slice) => {
              const pct = totalAssets > 0 ? ((slice.value / totalAssets) * 100).toFixed(1) : 0
              return (
                <div key={slice.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 'bold', color: '#4b5563' }}>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: slice.color }}></span>
                  <span>{slice.label} ({pct}%)</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Holdings List Table */}
      <div className="holdings-table-container">
        <div className="holdings-table-header">
          <div className="table-title-area">
            <h3 className="table-title">보유 주식 목록</h3>
            <span className="table-tip">💡 종목 클릭 시 해당 종목의 주문창(호가창)으로 이동합니다.</span>
          </div>
          <button className="history-modal-btn" onClick={() => setShowHistory(true)}>
            📜 거래 내역 조회
          </button>
        </div>

        <div className="holdings-table-wrapper">
          {detailedHoldings.length > 0 ? (
            <table className="holdings-table">
              <thead>
                <tr>
                  <th>종목코드</th>
                  <th>종목명</th>
                  <th className="align-right">보유수량</th>
                  <th className="align-right">평단가</th>
                  <th className="align-right">현재가</th>
                  <th className="align-right">평가금액</th>
                  <th className="align-right">평가손익</th>
                  <th className="align-right">수익률</th>
                </tr>
              </thead>
              <tbody>
                {detailedHoldings.map((h) => {
                  const isProfit = h.profit > 0
                  const isLoss = h.profit < 0

                  return (
                    <tr 
                      key={h.id} 
                      className="holding-row"
                      onClick={() => onSelectHolding(h.stockCode)}
                    >
                      <td className="holding-code">{h.stockCode}</td>
                      <td className="holding-name"><strong>{h.name}</strong></td>
                      <td className="align-right">{h.quantity.toLocaleString()}주</td>
                      <td className="align-right">{h.averagePrice.toLocaleString()}원</td>
                      <td className="align-right">{h.currentPrice.toLocaleString()}원</td>
                      <td className="align-right">{formatCurrency(h.valuation)}</td>
                      <td className={`align-right ${isProfit ? 'fluctuation-up' : isLoss ? 'fluctuation-down' : ''}`}>
                        {h.profit > 0 ? '+' : ''}{h.profit.toLocaleString()}원
                      </td>
                      <td className={`align-right ${getFluctuationClass(h.returnRate)}`}>
                        <strong>{formatFluctuationRate(h.returnRate)}</strong>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="holdings-empty">
              보유 중인 주식이 없습니다. 주문 탭에서 첫 거래를 시작해 보세요!
            </div>
          )}
        </div>
      </div>

      {/* Transaction History Modal Popup */}
      {showHistory && (
        <div className="history-modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="history-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="history-modal-header">
              <h3 className="history-modal-title">전체 거래 내역</h3>
              <button className="close-history-btn" onClick={() => setShowHistory(false)}>
                &times;
              </button>
            </div>

            {/* Filter controls */}
            <div className="history-filters">
              <div className="filter-group">
                <label className="filter-label">종목 검색</label>
                <input
                  type="text"
                  className="filter-input"
                  value={filterStock}
                  onChange={(e) => setFilterStock(e.target.value)}
                  placeholder="종목코드 검색 (예: AAPL)..."
                />
              </div>
              <div className="filter-group">
                <label className="filter-label">거래 구분</label>
                <select
                  className="filter-input"
                  value={filterSide}
                  onChange={(e) => setFilterSide(e.target.value)}
                >
                  <option value="ALL">전체</option>
                  <option value="BUY">매수</option>
                  <option value="SELL">매도</option>
                  <option value="DEPOSIT">입금</option>
                  <option value="WITHDRAW">출금</option>
                </select>
              </div>
              <div className="filter-group">
                <label className="filter-label">조회 시작일</label>
                <input
                  type="date"
                  className="filter-input"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                />
              </div>
              <div className="filter-group">
                <label className="filter-label">조회 종료일</label>
                <input
                  type="date"
                  className="filter-input"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="history-modal-body">
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>거래 내역 불러오는 중...</div>
              ) : pagedHistory.length > 0 ? (
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>주문 시간</th>
                      <th>종목</th>
                      <th>구분</th>
                      <th>유형</th>
                      <th style={{ textAlign: 'right' }}>수량</th>
                      <th style={{ textAlign: 'right' }}>주문단가</th>
                      <th style={{ textAlign: 'right' }}>체결단가</th>
                      <th style={{ textAlign: 'center' }}>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedHistory.map((item) => {
                      const dateStr = new Date(item.createdAt).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      });

                      const getSideBadge = (type) => {
                        if (type === 'BUY') return <span className="badge-buy">매수</span>
                        if (type === 'SELL') return <span className="badge-sell">매도</span>
                        if (type === 'DEPOSIT') return <span className="badge-deposit">입금</span>
                        if (type === 'WITHDRAW') return <span className="badge-withdraw">출금</span>
                        return null
                      }

                      const getStatusBadge = (status, type) => {
                        const isTx = type === 'DEPOSIT' || type === 'WITHDRAW'
                        if (status === 'FILLED') {
                          return <span className="badge-filled">{isTx ? '완료' : '체결 완료'}</span>
                        }
                        if (status === 'PENDING') {
                          return <span className="badge-pending">대기 중</span>
                        }
                        return <span className="badge-cancelled">주문 취소</span>
                      }

                      return (
                        <tr key={item.id}>
                          <td className="history-time">{dateStr}</td>
                          <td style={{ fontWeight: 'bold', fontFamily: 'ui-monospace, Consolas, monospace' }}>
                            {item.stockCode}
                          </td>
                          <td>
                            {getSideBadge(item.type)}
                          </td>
                          <td>
                            {item.orderType === 'LIMIT' ? '지정가' : item.orderType === 'MIT' ? 'MIT' : item.orderType === 'MARKET' ? '시장가' : item.orderType}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {item.quantity ? `${item.quantity.toLocaleString()}주` : '-'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {item.price ? `${item.price.toLocaleString()}원` : '-'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                            {item.executedPrice ? `${item.executedPrice.toLocaleString()}원` : '-'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {getStatusBadge(item.status, item.type)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="history-empty">조건에 맞는 거래 내역이 없습니다.</div>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pagination" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '16px', padding: '5px 0' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="pag-btn"
                >
                  이전
                </button>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#4b5563' }}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="pag-btn"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default HoldingsView;
