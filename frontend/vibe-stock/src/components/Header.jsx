import './Header.css'

function Header({ username, onLogout, activeTab, setActiveTab }) {
  const nickname = localStorage.getItem('nickname') || username;

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="app-header__brand">
          <span className="app-header__logo" aria-hidden="true">
            VS
          </span>
          <div>
            <p className="app-header__title">Vibe Stock</p>
            <p className="app-header__subtitle">주식 모의투자</p>
          </div>
        </div>

        <nav className="app-header__nav" aria-label="주요 메뉴">
          <button
            className={`app-header__nav-item ${activeTab === 'dashboard' ? 'app-header__nav-item--active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            대시보드
          </button>
          <button
            className={`app-header__nav-item ${activeTab === 'order' ? 'app-header__nav-item--active' : ''}`}
            onClick={() => setActiveTab('order')}
          >
            주문
          </button>
          <button
            className={`app-header__nav-item ${activeTab === 'holdings' ? 'app-header__nav-item--active' : ''}`}
            onClick={() => setActiveTab('holdings')}
          >
            보유종목
          </button>
          <button
            className={`app-header__nav-item ${activeTab === 'rankings' ? 'app-header__nav-item--active' : ''}`}
            onClick={() => setActiveTab('rankings')}
          >
            실시간 랭킹
          </button>
          <button
            className={`app-header__nav-item ${activeTab === 'settings' ? 'app-header__nav-item--active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            설정
          </button>
        </nav>

        {username && (
          <div className="app-header__user">
            <span className="app-header__username">
              <span className="app-header__user-badge">●</span> {nickname}님 ({username})
            </span>
            <button className="app-header__logout-btn" onClick={onLogout}>
              로그아웃
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header

