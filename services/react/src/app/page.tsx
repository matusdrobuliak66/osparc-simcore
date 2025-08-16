'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import AccountDropdown from '@/components/AccountDropdown';

export default function Home() {
  return (
    <ProtectedRoute>
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="header-content">
            <div className="logo-section">
              <h1>oSPARC</h1>
              <span className="version">Dashboard</span>
            </div>
            <div className="header-actions">
              <AccountDropdown />
            </div>
          </div>
        </header>

        <main className="dashboard-main">
          <div className="welcome-section">
            <h2>Welcome to oSPARC!</h2>
            <p>You are successfully logged in. The dashboard will be built in the next phase.</p>
          </div>
        </main>

        <style jsx>{`
          .dashboard {
            min-height: 100vh;
            background-color: #f8f9fa;
          }

          .dashboard-header {
            background: white;
            border-bottom: 1px solid #e9ecef;
            padding: 0 24px;
          }

          .header-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 64px;
            max-width: 1200px;
            margin: 0 auto;
          }

          .logo-section {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .logo-section h1 {
            color: #007bff;
            font-size: 28px;
            font-weight: 600;
            margin: 0;
          }

          .version {
            background-color: #e9ecef;
            color: #6c757d;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
          }

          .header-actions {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .dashboard-main {
            padding: 40px 24px;
            max-width: 1200px;
            margin: 0 auto;
          }

          .welcome-section {
            background: white;
            border-radius: 8px;
            padding: 40px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }

          .welcome-section h2 {
            color: #333;
            font-size: 32px;
            margin-bottom: 16px;
          }

          .welcome-section p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
