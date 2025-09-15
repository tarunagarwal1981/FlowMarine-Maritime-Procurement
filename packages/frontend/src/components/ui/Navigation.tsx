/**
 * Navigation Component
 * Role-based navigation with mobile-first design
 */

import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { useAppSelector } from '../../store/hooks';
import { selectUser, selectHasPermission } from '../../store/slices/authSlice';

export interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  permission?: string;
  badge?: string | number;
  children?: NavigationItem[];
}

export interface NavigationProps {
  items: NavigationItem[];
  currentPath?: string;
  className?: string;
  onItemClick?: (item: NavigationItem) => void;
  mobile?: boolean;
}

export function Navigation({
  items,
  currentPath = '',
  className,
  onItemClick,
  mobile = false,
}: NavigationProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const user = useAppSelector(selectUser);

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const hasPermission = (permission?: string) => {
    if (!permission) return true;
    return useAppSelector(selectHasPermission(permission));
  };

  const isActive = (item: NavigationItem): boolean => {
    if (item.href) {
      return currentPath === item.href || currentPath.startsWith(item.href + '/');
    }
    return false;
  };

  const renderNavigationItem = (item: NavigationItem, level = 0) => {
    // Check permissions
    if (!hasPermission(item.permission)) {
      return null;
    }

    const active = isActive(item);
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);

    const handleClick = () => {
      if (hasChildren) {
        toggleExpanded(item.id);
      }
      
      if (item.onClick) {
        item.onClick();
      }
      
      if (onItemClick) {
        onItemClick(item);
      }
    };

    const itemClasses = cn(
      'nav-link group relative',
      'flex items-center justify-between w-full text-left',
      'transition-all duration-200',
      level > 0 && 'ml-6 pl-4 border-l-2 border-gray-200',
      active
        ? 'nav-link-active bg-maritime-100 text-maritime-700 border-l-maritime-500'
        : 'nav-link-inactive text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      mobile && 'py-4 px-6 border-b border-gray-100'
    );

    return (
      <div key={item.id}>
        <button
          onClick={handleClick}
          className={itemClasses}
          aria-expanded={hasChildren ? isExpanded : undefined}
        >
          <div className="flex items-center flex-1 min-w-0">
            <span className="flex-shrink-0 mr-3 text-lg">
              {item.icon}
            </span>
            <span className="truncate font-medium">
              {item.label}
            </span>
            {item.badge && (
              <span className={cn(
                'ml-2 px-2 py-1 text-xs font-medium rounded-full',
                typeof item.badge === 'number' && item.badge > 0
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              )}>
                {item.badge}
              </span>
            )}
          </div>
          
          {hasChildren && (
            <span className="flex-shrink-0 ml-2">
              <svg
                className={cn(
                  'w-5 h-5 transition-transform duration-200',
                  isExpanded && 'rotate-90'
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </span>
          )}
        </button>

        {/* Submenu */}
        {hasChildren && isExpanded && (
          <div className={cn(
            'mt-1 space-y-1',
            mobile && 'bg-gray-50'
          )}>
            {item.children!.map((child) => renderNavigationItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className={cn('space-y-1', className)} role="navigation">
      {items.map((item) => renderNavigationItem(item))}
    </nav>
  );
}

// Mobile Navigation Drawer
export interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  items: NavigationItem[];
  currentPath?: string;
  onItemClick?: (item: NavigationItem) => void;
}

export function MobileNavigation({
  isOpen,
  onClose,
  items,
  currentPath,
  onItemClick,
}: MobileNavigationProps) {
  const user = useAppSelector(selectUser);

  const handleItemClick = (item: NavigationItem) => {
    onItemClick?.(item);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 backdrop-blur-mobile sm:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Navigation Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-white shadow-xl transform transition-transform duration-300 ease-in-out sm:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 safe-top">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-maritime-600 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7v10c0 5.55 3.84 9.739 9 11 5.16-1.261 9-5.45 9-11V7l-10-5z" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-gray-900">FlowMarine</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 touch-target"
            aria-label="Close navigation"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User Info */}
        {user && (
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-maritime-100 rounded-full flex items-center justify-center">
                <span className="text-maritime-600 font-medium">
                  {user.firstName[0]}{user.lastName[0]}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-500">{user.role.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-4 safe-bottom">
          <Navigation
            items={items}
            currentPath={currentPath}
            onItemClick={handleItemClick}
            mobile={true}
          />
        </div>
      </div>
    </>
  );
}

// Navigation items configuration based on user role
export const getNavigationItems = (userRole?: string): NavigationItem[] => {
  const baseItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
        </svg>
      ),
      href: '/dashboard',
    },
    {
      id: 'requisitions',
      label: 'Requisitions',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      children: [
        {
          id: 'requisitions-create',
          label: 'Create New',
          icon: (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          ),
          href: '/requisitions/new',
          permission: 'requisitions:create',
        },
        {
          id: 'requisitions-list',
          label: 'My Requisitions',
          icon: (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          ),
          href: '/requisitions',
        },
        {
          id: 'requisitions-offline',
          label: 'Offline Items',
          icon: (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          ),
          href: '/requisitions/offline',
        },
      ],
    },
  ];

  // Add role-specific items
  if (['PROCUREMENT_MANAGER', 'ADMIN'].includes(userRole || '')) {
    baseItems.push({
      id: 'vendors',
      label: 'Vendors',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      href: '/vendors',
      permission: 'vendors:read',
    });
  }

  if (['FINANCE_TEAM', 'ADMIN'].includes(userRole || '')) {
    baseItems.push({
      id: 'finance',
      label: 'Finance',
      icon: (
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
      ),
      children: [
        {
          id: 'finance-invoices',
          label: 'Invoices',
          icon: (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          href: '/finance/invoices',
          permission: 'finance:read',
        },
        {
          id: 'finance-payments',
          label: 'Payments',
          icon: (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          ),
          href: '/finance/payments',
          permission: 'finance:read',
        },
      ],
      permission: 'finance:read',
    });
  }

  return baseItems;
};