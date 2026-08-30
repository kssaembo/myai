import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth-context'
import {
  applyTheme,
  getInitialTheme,
  THEME_STORAGE_KEY,
  type AppColorTheme,
} from '@/shared/lib/theme'

type IconName =
  'dashboard' | 'search' | 'knowledge' | 'projects' | 'graph' | 'imports' | 'settings' | 'trash'

const navigation: { label: string; to: string; icon: IconName; end?: boolean }[] = [
  { label: 'Home', to: '/', icon: 'dashboard', end: true },
  { label: 'Knowledge', to: '/knowledge', icon: 'knowledge' },
  { label: 'Projects', to: '/projects', icon: 'projects' },
  { label: 'Graph', to: '/graph', icon: 'graph' },
  { label: 'Search', to: '/search', icon: 'search' },
  { label: 'Imports', to: '/imports', icon: 'imports' },
]

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/knowledge': 'Knowledge',
  '/projects': 'Projects',
  '/graph': 'Knowledge Graph',
  '/imports': 'Imports',
  '/search': 'Search',
  '/settings/taxonomy': 'Settings',
  '/settings/ai': 'AI Settings',
  '/trash': 'Trash',
}

function getPageTitle(pathname: string) {
  if (pathname.startsWith('/knowledge')) return 'Knowledge'
  if (pathname.startsWith('/projects')) return 'Projects'
  return pageTitles[pathname] ?? 'Knowledge OS'
}

function NavigationIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m15.5 15.5 5 5" />
      </>
    ),
    knowledge: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
        <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z" />
      </>
    ),
    projects: (
      <>
        <path d="M3 7h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h6" />
      </>
    ),
    graph: (
      <>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <circle cx="12" cy="18" r="2.5" />
        <path d="m8.4 7.2 7.2 0M7.4 8.2l3.3 7.5M16.6 8.2l-3.3 7.5" />
      </>
    ),
    imports: (
      <>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M4 18v3h16v-3" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

export function AppShell() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [signOutError, setSignOutError] = useState(false)
  const [theme, setTheme] = useState<AppColorTheme>(() =>
    getInitialTheme(
      window.localStorage.getItem(THEME_STORAGE_KEY),
      window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
    ),
  )
  const globalSearchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    applyTheme(theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault()
        globalSearchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  const handleSignOut = async () => {
    setSignOutError(false)
    try {
      await signOut()
    } catch {
      setSignOutError(true)
    }
  }
  const isHome = location.pathname === '/'

  return (
    <div className="app-shell">
      {isSidebarOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar${isSidebarOpen ? ' is-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark compact" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <strong>Knowledge OS</strong>
            <span>Personal workspace</span>
          </div>
        </div>

        <nav className="primary-navigation" aria-label="주요 메뉴">
          <p className="navigation-label">Workspace</p>
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) => `navigation-link${isActive ? ' active' : ''}`}
            >
              <NavigationIcon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <p className="navigation-label settings-label">System</p>
          <NavLink
            to="/settings/ai"
            onClick={() => setIsSidebarOpen(false)}
            className={({ isActive }) => `navigation-link${isActive ? ' active' : ''}`}
          >
            <NavigationIcon name="settings" />
            <span>Settings</span>
          </NavLink>
          <NavLink
            to="/trash"
            onClick={() => setIsSidebarOpen(false)}
            className={({ isActive }) => `navigation-link${isActive ? ' active' : ''}`}
          >
            <NavigationIcon name="trash" />
            <span>Trash</span>
          </NavLink>
        </nav>
      </aside>

      <div className="app-workspace">
        <header className="app-header">
          <div className="header-leading">
            <button
              className="icon-button menu-button"
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="메뉴 열기"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <Link className="header-brand" to="/">
              <div className="brand-mark compact" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div>
                <strong>MY AI</strong>
                <span>{isHome ? 'Personal Intelligence' : getPageTitle(location.pathname)}</span>
              </div>
            </Link>
          </div>
          <div className="header-actions">
            {!isHome && (
              <form
                className="global-search"
                role="search"
                onSubmit={(event) => {
                  event.preventDefault()
                  const query = globalSearchRef.current?.value.trim() ?? ''
                  void navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search')
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="6" />
                  <path d="m16 16 4 4" />
                </svg>
                <span className="sr-only">전체 검색</span>
                <input
                  ref={globalSearchRef}
                  key={location.pathname === '/search' ? location.search : 'global-search'}
                  type="search"
                  defaultValue={
                    location.pathname === '/search'
                      ? (new URLSearchParams(location.search).get('q') ?? '')
                      : ''
                  }
                  placeholder="전체 지식 검색"
                />
                <kbd>⌘ K</kbd>
              </form>
            )}
            <button
              className="icon-button utility-button theme-toggle"
              type="button"
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? '라이트모드로 전환' : '다크모드로 전환'}
              title={theme === 'dark' ? '라이트모드' : '다크모드'}
            >
              {theme === 'dark' ? (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M20.3 15.1A8.5 8.5 0 0 1 8.9 3.7 8.5 8.5 0 1 0 20.3 15.1Z" />
                </svg>
              )}
            </button>
            <button
              className="header-button"
              type="button"
              onClick={() => void navigate('/imports')}
              title="원본 파일 업로드"
            >
              지식 가져오기
            </button>
            <button
              className="icon-button utility-button"
              type="button"
              onClick={() => void navigate('/settings/ai')}
              aria-label="설정"
              title="설정"
            >
              <NavigationIcon name="settings" />
            </button>
            <div className="header-account" title={user?.email ?? '개인 계정'}>
              <span>{user?.email?.slice(0, 1).toUpperCase() ?? 'U'}</span>
              <small>{user?.email}</small>
            </div>
            <button
              className="icon-button utility-button"
              type="button"
              onClick={() => void handleSignOut()}
              aria-label="로그아웃"
              title="로그아웃"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" />
              </svg>
            </button>
          </div>
        </header>

        {signOutError && (
          <div className="shell-alert" role="alert">
            로그아웃하지 못했습니다. 네트워크 연결을 확인해 주세요.
          </div>
        )}
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
