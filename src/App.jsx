import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Contacts from './pages/Contacts'
import Feed from './pages/Feed'
import Profile from './pages/Profile'
import Chat from './pages/Chat'
import AgentProfile from './pages/AgentProfile'
import { UserProvider } from './store/user'

// Pages that show the bottom nav
const TAB_PATHS = ['/contacts', '/feed', '/profile']

function Layout() {
  const location = useLocation()
  const showNav = TAB_PATHS.includes(location.pathname)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/contacts" replace />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/chat/:agentId" element={<Chat />} />
          <Route path="/agent/:agentId" element={<AgentProfile />} />
        </Routes>
      </div>
      {showNav && <BottomNav />}
    </div>
  )
}

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </UserProvider>
  )
}
