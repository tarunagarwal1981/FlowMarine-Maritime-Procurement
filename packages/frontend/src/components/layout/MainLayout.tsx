import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { env } from '../../config/env';
import { Anchor } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                <Anchor className="h-5 w-5 text-white" />
              </div>
              <Link
                to="/"
                className="text-xl font-semibold text-slate-800 hover:text-blue-600 transition-colors"
              >
                {env.VITE_APP_NAME}
              </Link>
            </div>
            
            {/* Navigation */}
            <nav className="hidden md:flex space-x-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    item.current
                      ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button className="p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pb-8">
        <Outlet />
      </main>
    </div>
  );
};