import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Match from './pages/Match';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import { PopupProvider } from './components/PopupProvider';
import ScrollAnimator from './components/ScrollAnimator';
import MobileBottomNav from './components/MobileBottomNav';

function App() {
  return (
    <PopupProvider>
      <BrowserRouter>
        <ScrollAnimator />
        <div className='layout-content-wrapper'>
          <Routes>
            <Route path='/' element={<Home/>} />
            <Route path='/login' element={<Login/>} />
            <Route path='/dashboard' element={<Dashboard/>} />
            <Route path='/chat' element={<Chat/>} />
            <Route path='/match' element={<Match/>} />
            <Route path='/admin' element={<Admin/>} />
            <Route path='/profile' element={<Profile/>} />
          </Routes>
        </div>
        <MobileBottomNav />
      </BrowserRouter>
    </PopupProvider>
  );
}

export default App;
