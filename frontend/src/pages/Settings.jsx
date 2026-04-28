import React, { useState } from 'react';
import { useSettings } from '../components/SettingsProvider';
import { useNavigate } from 'react-router-dom';

const colors = [
  { value: 'blue', name: 'Ocean Blue', hex: '#0061A4' },
  { value: 'green', name: 'Emerald', hex: '#006D42' },
  { value: 'purple', name: 'Amethyst', hex: '#6750A4' },
  { value: 'orange', name: 'Sunset', hex: '#B3261E' }, // technically rusty red/coral
  { value: 'red', name: 'Crimson', hex: '#9A2500' }
];

export default function Settings() {
  const navigate = useNavigate();
  const { themeMode, setThemeMode, themeColor, setThemeColor, preferences, updatePreference } = useSettings();

  const handleToggle = (key) => {
    updatePreference(key, !preferences[key]);
  };

  return (
    <div className="container main-content settings-main">
      <div className="section-header">
        <h2>App Settings</h2>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>

      {/* Appearance Section */}
      <div className="card settings-card md-elevation-1">
        <h3 className="settings-section-title">Appearance</h3>
        
        {/* Dark Mode Toggle */}
        <div className="settings-row">
          <div className="settings-info">
            <span className="settings-label">Theme Mode</span>
            <span className="settings-desc">Choose Light, Dark, or System Sync</span>
          </div>
          <div className="md-segmented-control">
            <button 
              className={themeMode === 'light' ? 'active' : ''} 
              onClick={() => setThemeMode('light')}>Light</button>
            <button 
              className={themeMode === 'dark' ? 'active' : ''} 
              onClick={() => setThemeMode('dark')}>Dark</button>
            <button 
              className={themeMode === 'system' ? 'active' : ''} 
              onClick={() => setThemeMode('system')}>System</button>
          </div>
        </div>

        {/* Color Picker */}
        <div className="settings-row color-picker-row">
          <div className="settings-info">
            <span className="settings-label">App Highlight Color</span>
            <span className="settings-desc">Pick your material base color</span>
          </div>
          <div className="color-swatches">
            {colors.map(c => (
              <button 
                key={c.value}
                className={`color-swatch ${themeColor === c.value ? 'selected' : ''}`}
                style={{ backgroundColor: c.hex }}
                onClick={() => setThemeColor(c.value)}
                aria-label={`Select ${c.name} theme`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Advanced Settings Section (20 Toggles as Requested) */}
      <div className="card settings-card md-elevation-1 md-form">
        <h3 className="settings-section-title">Preferences & Connectivity</h3>
        <div className="settings-toggles-grid">
          {Object.keys(preferences).map(key => {
            if (typeof preferences[key] === 'boolean') {
              return (
                <div className="settings-toggle-row" key={key}>
                  <label className="md-switch-label" htmlFor={`switch-${key}`}>
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </label>
                  <label className="md-switch">
                    <input 
                      type="checkbox" 
                      id={`switch-${key}`} 
                      checked={preferences[key]} 
                      onChange={() => handleToggle(key)} 
                    />
                    <span className="md-slider round"></span>
                  </label>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>

      {/* Save / Cache Options */}
      <div className="card settings-card md-elevation-1">
        <h3 className="settings-section-title">Storage & Language</h3>
        <div className="settings-row">
          <div className="settings-info">
            <span className="settings-label">Clear Cache</span>
            <span className="settings-desc">Currently matching and map assets: 120MB</span>
          </div>
          <button className="btn btn-secondary md-btn-tonal" onClick={() => alert("Cache cleared!")}>
            Clear Now
          </button>
        </div>
      </div>

    </div>
  );
}