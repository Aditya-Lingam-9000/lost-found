import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../utils/config/firebaseConfig';
import { updateProfile, deleteUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { usePopup } from '../components/PopupProvider';

export default function Profile() {
  const navigate = useNavigate();
  const popup = usePopup();
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [avatarPreview, setAvatarPreview] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setDisplayName(u.displayName || '');
        setPhotoURL(u.photoURL || '');
        setAvatarPreview(u.photoURL || '');
        const storedPhone = localStorage.getItem(`cf_phone_${u.uid}`) || '';
        setPhoneNumber(storedPhone);
      } else {
        navigate('/login');
      }
    });
    return () => unsub();
  }, [navigate]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await updateProfile(user, { displayName, photoURL });
      localStorage.setItem(`cf_phone_${user.uid}`, phoneNumber);
      popup.notify('Profile updated successfully!', 'success');
      window.location.reload();
    } catch (err) {
      popup.notify('Failed to update profile: ' + err.message, 'error');
    }
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setPhotoURL(result);
      setAvatarPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async () => {
    const shouldDelete = await popup.confirm({
      title: 'Delete Account',
      message: 'Are you ABSOLUTELY sure you want to delete your account? This action cannot be undone.',
      confirmText: 'Delete Permanently',
      cancelText: 'Keep Account',
      tone: 'error',
    });
    if (!shouldDelete) return;

    try {
      await deleteUser(user);
      popup.notify('Account deleted.', 'success');
      navigate('/login');
    } catch (err) {
      popup.notify('Failed to delete account. You may need to log in again first. ' + err.message, 'error');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      popup.notify('Signed out successfully.', 'success');
      navigate('/');
    } catch (err) {
      popup.notify('Failed to sign out: ' + err.message, 'error');
    }
  };

  if (!user) return <p>Loading...</p>;

  return (
    <>
      <header className="nav mobile-hide-top-nav">
        <div className="container nav-inner">
          <Link to="/dashboard" className="brand">
            <span>Campus Finder</span>
          </Link>
          <Link to="/dashboard" className="nav-link">Back to Dashboard</Link>
        </div>
      </header>

      <main className="main-content container fade-in profile-main" style={{ maxWidth: '600px', marginTop: '40px' }}>
        <div className="card slide-up">
          <h2 className="page-gradient-title" style={{ marginBottom: '20px', color: 'var(--primary)' }}>My Profile</h2>
          
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img 
              src={avatarPreview || user.photoURL || 'https://via.placeholder.com/100'} 
              alt="Avatar" 
              style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary-light)' }} 
            />
            <p style={{ marginTop: '10px', color: 'var(--text-muted)' }}>{user.email}</p>
          </div>

          <form onSubmit={handleUpdate}>
            <div className="form-group">
              <label>Display Name</label>
              <input 
                type="text" 
                className="form-control" 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)} 
                placeholder="Your name..."
              />
            </div>
            <div className="form-group">
              <label>Upload Profile Image</label>
              <input 
                type="file" 
                className="form-control" 
                accept="image/*"
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                className="form-control"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. +91 98765 43210"
              />
            </div>
            <div className="form-group">
              <label>Logged-in Email</label>
              <input type="text" className="form-control" value={user.email || ''} readOnly />
            </div>
            
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '20px' }}>
              Save Settings
            </button>

            <div className="profile-mobile-signout-wrap">
              <button
                type="button"
                className="btn profile-mobile-signout-btn"
                onClick={handleSignOut}
              >
                Sign Out
              </button>
            </div>
          </form>

          <hr style={{ margin: '30px 0', border: 'none', borderTop: '1px solid #ddd' }} />
          
          <div>
            <h3 style={{ color: 'var(--danger)', marginBottom: '10px' }}>Danger Zone</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
              Once you delete your account, there is no going back.
            </p>
            <button onClick={handleDelete} className="btn" style={{ background: 'var(--danger)', color: 'white', width: '100%' }}>
              Permanently Delete Account
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
