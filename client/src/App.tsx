import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import DevComponents from './pages/DevComponents'
import DevUI from './pages/DevUI'
import Login from './pages/auth/Login'
import Landing from './pages/Landing'
import { AppLayout } from './components/layout/AppLayout'
import Overview from './pages/app/Overview'
import Schedules from './pages/app/Schedules'
import Temperature from './pages/app/Temperature'
import Insights from './pages/app/Insights'
import Recommendations from './pages/app/Recommendations'
import { useAuthStore } from './store/auth'

function AuthGuard({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const location = useLocation()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        
        <Route path="/app" element={<AuthGuard><AppLayout /></AuthGuard>}>
          <Route index element={<Navigate to="/app/overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="schedules" element={<Schedules />} />
          <Route path="temperature" element={<Temperature />} />
          <Route path="insights" element={<Insights />} />
          <Route path="recommendations" element={<Recommendations />} />
        </Route>

        <Route path="/dev/components" element={<DevComponents />} />
        <Route path="/dev/ui" element={<DevUI />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App