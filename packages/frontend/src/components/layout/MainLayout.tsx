import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { env } from '../../config/env';

export const MainLayout: React.FC = () => {
  const location = useLocation();

  const navigation = [
    { name: 'Home', href: '/', current: location.pathname === '/' },
    { name: 'Dashboard', href: '/dashboard', current: location.pathname === '/dashboard' },
    { name: 'Analytics', href: '/analytics', current: location.pathname === '/analytics' },
    { name: 'Requisitions', href: '/requisitions', current: location.pathname.startsWith('/requisitions') },
    { name: 'Catalog', href: '/catalog', current: location.pathname === '/catalog' },
    { name: 'Quotes', href: '/quotes', current: location.pathname === '/quotes' },
    { name: 'Reports', href: '/reports', current: location.pathname === '/reports' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link
                to="/"
                className="text-2xl font-bold text-blue-600 hover:text-blue-700"
              >
                {env.VITE_APP_NAME}
              </Link>
            </div>
            
            {/* Navigation */}
            <nav className="hidden md:flex space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    item.current
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main>
        <Outlet />
      </main>
    </div>
  );
};