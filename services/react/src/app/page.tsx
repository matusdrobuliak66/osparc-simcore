'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import AccountDropdown from '@/components/AccountDropdown';
import Dashboard from '@/components/Dashboard';

export default function Home() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6">
          <div className="flex items-center justify-between h-16 max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-primary-600">
                oSPARC
              </h1>
              <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded text-xs font-medium">
                Dashboard
              </span>
            </div>
            <div className="flex items-center gap-4">
              <AccountDropdown />
            </div>
          </div>
        </header>

        <main>
          <Dashboard />
        </main>
      </div>
    </ProtectedRoute>
  );
}
