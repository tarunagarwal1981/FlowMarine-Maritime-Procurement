import React from 'react';
import { Link } from 'react-router-dom';
import { env } from '../config/env';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { Button, Badge, Card } from '../components/ui';

export const HomePage: React.FC = () => {
  const { isOnline, pendingSyncCount } = useOfflineSync();

  return (
    <div className="max-w-7xl mx-auto py-6 sm:py-12 mobile-padding">
      {/* Hero Section - Mobile Optimized */}
      <div className="text-center animate-fade-in">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl md:text-5xl lg:text-6xl">
          <span className="block">Welcome to</span>
          <span className="block text-maritime-600 mt-1">{env.VITE_APP_NAME}</span>
        </h1>
        <p className="mt-4 max-w-md mx-auto text-mobile-base text-gray-500 sm:max-w-2xl md:mt-6 lg:max-w-3xl">
          {env.VITE_PWA_DESCRIPTION}
        </p>
        
        {/* Action Buttons */}
        <div className="mt-6 space-y-3 sm:space-y-0 sm:flex sm:justify-center sm:space-x-4 md:mt-8">
          <Link to="/requisitions/create">
            <Button 
              variant="primary"
              size="lg"
              fullWidth
              className="sm:w-auto"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
              aria-label="Create new requisition"
            >
              Create Requisition
            </Button>
          </Link>
          <div className="relative">
            <Link to="/requisitions">
              <Button 
                variant="outline"
                size="lg"
                fullWidth
                className="sm:w-auto"
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                }
                aria-label="View requisitions"
              >
                View Requisitions
              </Button>
            </Link>
            {pendingSyncCount > 0 && (
              <Badge 
                variant="error" 
                className="absolute -top-2 -right-2 min-w-[1.5rem] h-6"
              >
                {pendingSyncCount}
              </Badge>
            )}
          </div>
        </div>
      </div>
      
      {/* Feature Cards */}
      <div className="mt-12 sm:mt-16">
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Link to="/dashboard">
            <Card variant="interactive" className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-maritime-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-maritime-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-mobile-lg font-medium text-gray-900">Dashboard</h3>
                  <p className="mt-2 text-mobile-sm text-gray-600">
                    Real-time insights and analytics for your maritime operations
                  </p>
                </div>
              </div>
            </Card>
          </Link>
          
          <Link to="/analytics">
            <Card variant="interactive" className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-mobile-lg font-medium text-gray-900">Analytics</h3>
                  <p className="mt-2 text-mobile-sm text-gray-600">
                    Advanced analytics and performance tracking
                  </p>
                </div>
              </div>
            </Card>
          </Link>
          
          <Card variant="interactive" className="animate-slide-up md:col-span-2 lg:col-span-1" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-navy-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-mobile-lg font-medium text-gray-900">Offline Support</h3>
                <p className="mt-2 text-mobile-sm text-gray-600">
                  Mobile-first design with offline capabilities for vessel operations
                </p>
                <div className="mt-3">
                  <Badge 
                    variant={isOnline ? 'success' : 'warning'} 
                    dot
                    className="animate-pulse"
                  >
                    {isOnline ? 'Online' : 'Offline Mode'}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};