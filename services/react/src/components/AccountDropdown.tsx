'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function AccountDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout, isLoading } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
  };

  if (!user) {
    return null;
  }

  return (
    <div className="account-dropdown" ref={dropdownRef}>
      <button
        className="account-button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
      >
        <div className="user-avatar">
          {user.email.charAt(0).toUpperCase()}
        </div>
        <span className="user-email">{user.email}</span>
        <svg
          className={`dropdown-icon ${isOpen ? 'open' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="dropdown-menu">
          <div className="dropdown-header">
            <div className="user-info">
              <div className="user-email-full">{user.email}</div>
              <div className="user-status">Signed in</div>
            </div>
          </div>
          <div className="dropdown-divider"></div>
          <button
            className="dropdown-item logout-item"
            onClick={handleLogout}
            disabled={isLoading}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 13L1 13L1 3L6 3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M11 9L15 5L11 1"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M15 5L4 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {isLoading ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      )}

      <style jsx>{`
        .account-dropdown {
          position: relative;
          display: inline-block;
        }

        .account-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
        }

        .account-button:hover:not(:disabled) {
          background-color: #f8f9fa;
          border-color: #adb5bd;
        }

        .account-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .user-avatar {
          width: 32px;
          height: 32px;
          background-color: #007bff;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 14px;
        }

        .user-email {
          color: #333;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dropdown-icon {
          color: #666;
          transition: transform 0.2s;
        }

        .dropdown-icon.open {
          transform: rotate(180deg);
        }

        .dropdown-menu {
          position: absolute;
          top: 100%;
          right: 0;
          margin-top: 4px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          min-width: 250px;
          z-index: 1000;
        }

        .dropdown-header {
          padding: 12px 16px;
        }

        .user-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .user-email-full {
          font-weight: 500;
          color: #333;
          font-size: 14px;
        }

        .user-status {
          font-size: 12px;
          color: #666;
        }

        .dropdown-divider {
          height: 1px;
          background-color: #eee;
          margin: 0 16px;
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 12px 16px;
          background: none;
          border: none;
          text-align: left;
          cursor: pointer;
          transition: background-color 0.2s;
          font-size: 14px;
        }

        .dropdown-item:hover:not(:disabled) {
          background-color: #f8f9fa;
        }

        .dropdown-item:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .logout-item {
          color: #dc3545;
          border-radius: 0 0 7px 7px;
        }

        .logout-item:hover:not(:disabled) {
          background-color: #fff5f5;
        }
      `}</style>
    </div>
  );
}
