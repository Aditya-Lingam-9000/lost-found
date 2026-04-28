import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }) {
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('themeMode') || 'system';
  });
  const [themeColor, setThemeColor] = useState(() => {
    return localStorage.getItem('themeColor') || 'blue';
  });
  
  // Example dummy settings (for the 20+ config request)
  const [preferences, setPreferences] = useState(() => {
    const saved = localStorage.getItem('appPreferences');
    return saved ? JSON.parse(saved) : {
      pushNotifications: true,
      emailAlerts: false,
      locationTracking: true,
      highResImages: true,
      autoPlayVideos: false,
      soundEffects: true,
      hapticFeedback: true,
      offlineMode: false,
      incognitoMode: false,
      biometricLogin: false,
      dataSaveMode: false,
      autoSync: true,
      language: 'en',
      cacheSize: '100MB',
      analyticsShared: true,
      developerMode: false,
      autoArchive: false,
      showReadReceipts: true,
      strictMatching: false,
      reducedMotion: false,
    };
  });

  useEffect(() => {
    localStorage.setItem('themeMode', themeMode);
    
    // Apply dark/light logic
    const isDark = 
      themeMode === 'dark' || 
      (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
    if (isDark) {
      document.body.classList.add('theme-dark');
      document.body.classList.remove('theme-light');
    } else {
      document.body.classList.add('theme-light');
      document.body.classList.remove('theme-dark');
    }
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem('themeColor', themeColor);
    // Apply color theme
    document.body.classList.remove('color-blue', 'color-green', 'color-purple', 'color-orange', 'color-red');
    document.body.classList.add(`color-${themeColor}`);
  }, [themeColor]);

  useEffect(() => {
    localStorage.setItem('appPreferences', JSON.stringify(preferences));
  }, [preferences]);

  const updatePreference = (key, value) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const value = {
    themeMode,
    setThemeMode,
    themeColor,
    setThemeColor,
    preferences,
    updatePreference
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}