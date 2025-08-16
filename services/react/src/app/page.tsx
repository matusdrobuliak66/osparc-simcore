'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import AccountDropdown from '@/components/AccountDropdown';

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

        <main className="py-10 px-6 max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-10 text-center">
            <h2 className="text-3xl font-semibold text-gray-900 mb-4">
              Welcome to oSPARC!
            </h2>
            <p className="text-gray-600 text-lg leading-relaxed">
              You are successfully logged in. The dashboard will be built in the next phase.
            </p>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
