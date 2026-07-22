import { useState, useEffect } from 'react'
import { apiFetch } from '../api/client'
import { formatCurrency, formatFluctuationRate, getFluctuationClass } from '../utils/format'
import './RankingsView.css'

function RankingsView({ currentUsername }) {
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchRankings = async () => {
    try {
      const data = await apiFetch('/api/trading/rankings')
      setRankings(data)
    } catch (err) {
      console.error(err)
      setError('랭킹 데이터를 가져오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRankings()
  }, [])

  if (loading) {
    return <div className="rankings-loading">실시간 랭킹 산출 중...</div>
  }

  return (
    <div className="rankings-view">
      {error && <div className="rankings-error">{error}</div>}

      {/* Intro Header */}
      <section className="rankings-header-section">
        <div className="rankings-header-text">
          <h1 className="rankings-title">📈 모의투자 실시간 랭킹</h1>
          <p className="rankings-desc">
            가입한 모든 모의 투자자들의 자산 총액 및 수익률 랭킹입니다. 수익률은 초기 자산(1,000만 원) 기준입니다.
          </p>
        </div>
        <button className="rankings-refresh-btn" onClick={fetchRankings}>
          🔄 랭킹 갱신
        </button>
      </section>

      {/* Rankings List Card */}
      <div className="rankings-card">
        <div className="rankings-table-wrapper">
          <table className="rankings-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'center', width: '80px' }}>순위</th>
                <th>사용자명</th>
                <th style={{ textAlign: 'right' }}>보유 예수금</th>
                <th style={{ textAlign: 'right' }}>총 자산 평가액</th>
                <th style={{ textAlign: 'right', width: '150px' }}>누적 수익률</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((user) => {
                const isMe = user.username === currentUsername
                const isTop3 = user.rank <= 3
                let medal = ''
                if (user.rank === 1) medal = '🥇'
                if (user.rank === 2) medal = '🥈'
                if (user.rank === 3) medal = '🥉'

                return (
                  <tr
                    key={user.username}
                    className={`rank-row ${isMe ? 'rank-row--me' : ''}`}
                  >
                    <td style={{ textAlign: 'center' }}>
                      {isTop3 ? (
                        <span className="rank-medal">{medal}</span>
                      ) : (
                        <span className="rank-num">{user.rank}위</span>
                      )}
                    </td>
                    <td className="rank-username">
                      <strong>{user.nickname || user.username}</strong>
                      {isMe && <span className="me-badge">나</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {formatCurrency(user.balance)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                      {formatCurrency(user.totalAssets)}
                    </td>
                    <td
                      style={{ textAlign: 'right' }}
                      className={`rank-return ${getFluctuationClass(user.returnRate)}`}
                    >
                      <strong>{formatFluctuationRate(user.returnRate)}</strong>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default RankingsView
