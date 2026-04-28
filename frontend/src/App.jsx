import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Match from './pages/Match';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import { PopupProvider } from './components/PopupProvider';
import { SettingsProvider } from './components/SettingsProvider';
import { NotificationsProvider } from './components/NotificationsProvider';
import BiometricGate from './components/BiometricGate';
import AppInteractionFeedback from './components/AppInteractionFeedback';
import ScrollAnimator from './components/ScrollAnimator';
import MobileBottomNav from './components/MobileBottomNav';
import AndroidBackHandler from './components/AndroidBackHandler';
import AppOpeningAnimation from './components/AppOpeningAnimation';

function App() {
  return (
    <SettingsProvider>
      <PopupProvider>
        <BrowserRouter>
          <NotificationsProvider>
            <AppOpeningAnimation />
            <BiometricGate />
            <AppInteractionFeedback />
            <AndroidBackHandler />
            <ScrollAnimator />
            <div className='layout-content-wrapper'>
              <Routes>
                <Route path='/' element={<Home/>} />
                <Route path='/login' element={<Login/>} />
                <Route path='/dashboard' element={<Dashboard/>} />
                <Route path='/chat' element={<Chat/>} />
                <Route path='/match' element={<Match/>} />
                <Route path='/notifications' element={<Notifications/>} />
                <Route path='/admin' element={<Admin/>} />
                <Route path='/profile' element={<Profile/>} />
                <Route path='/settings' element={<Settings/>} />
              </Routes>
            </div>
            <MobileBottomNav />
          </NotificationsProvider>
        </BrowserRouter>
      </PopupProvider>
    </SettingsProvider>
  );
}

export default App;
