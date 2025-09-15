import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccessibilityProvider, useAccessibility } from '../../components/accessibility/AccessibilityProvider';
import { AccessibilityPanel } from '../../components/accessibility/AccessibilityPanel';
import { AdvancedSearchProvider, useAdvancedSearch } from '../../components/search/AdvancedSearchProvider';
import { AdvancedSearchInterface } from '../../components/search/AdvancedSearchInterface';
import { UserPreferencesProvider, useUserPreferences } from '../../components/preferences/UserPreferencesProvider';
import { UserPreferencesPanel } from '../../components/preferences/UserPreferencesPanel';
import { NotificationProvider, useNotifications } from '../../components/notifications/NotificationProvider';
import { NotificationCenter } from '../../components/notifications/NotificationCenter';
import { HelpProvider, useHelp } from '../../components/help/HelpProvider';
import { HelpCenter } from '../../components/help/HelpCenter';

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;

// Mock Notification API
global.Notification = {
  requestPermission: jest.fn().mockResolvedValue('granted'),
  permission: 'granted',
} as any;

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', {
  value: jest.fn(),
  writable: true,
});

describe('Advanced UI Improvements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Accessibility Features', () => {
    const TestComponent = () => {
      const { settings, updateSettings, announceToScreenReader } = useAccessibility();
      
      return (
        <div>
          <button onClick={() => updateSettings({ highContrast: !settings.highContrast })}>
            Toggle High Contrast
          </button>
          <button onClick={() => announceToScreenReader('Test announcement')}>
            Announce
          </button>
          <div data-testid="high-contrast">{settings.highContrast.toString()}</div>
        </div>
      );
    };

    it('should provide accessibility context', () => {
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      expect(screen.getByTestId('high-contrast')).toHaveTextContent('false');
    });

    it('should update accessibility settings', async () => {
      render(
        <AccessibilityProvider>
          <TestComponent />
        </AccessibilityProvider>
      );

      const toggleButton = screen.getByText('Toggle High Contrast');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByTestId('high-contrast')).toHaveTextContent('true');
      });
    });

    it('should render accessibility panel with all controls', () => {
      render(
        <AccessibilityProvider>
          <AccessibilityPanel />
        </AccessibilityProvider>
      );

      expect(screen.getByText('Accessibility Settings')).toBeInTheDocument();
      expect(screen.getByText('High Contrast Mode')).toBeInTheDocument();
      expect(screen.getByText('Large Text')).toBeInTheDocument();
      expect(screen.getByText('Reduced Motion')).toBeInTheDocument();
      expect(screen.getByText('Color Blind Support')).toBeInTheDocument();
    });

    it('should apply CSS classes when accessibility settings change', async () => {
      render(
        <AccessibilityProvider>
          <AccessibilityPanel />
        </AccessibilityProvider>
      );

      const highContrastSwitch = screen.getByRole('switch', { name: /high contrast/i });
      fireEvent.click(highContrastSwitch);

      await waitFor(() => {
        expect(document.documentElement).toHaveClass('high-contrast');
      });
    });

    it('should meet WCAG 2.1 AA requirements', () => {
      render(
        <AccessibilityProvider>
          <AccessibilityPanel />
        </AccessibilityProvider>
      );

      // Check for proper ARIA labels
      const switches = screen.getAllByRole('switch');
      switches.forEach(switchElement => {
        expect(switchElement).toHaveAttribute('aria-describedby');
      });

      // Check for proper heading structure
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  describe('Advanced Search and Filtering', () => {
    const mockSearchEndpoint = '/api/search';
    const mockFields = [
      { field: 'name', label: 'Name', type: 'text' as const },
      { field: 'status', label: 'Status', type: 'select' as const, options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' }
      ]},
      { field: 'date', label: 'Date', type: 'date' as const },
      { field: 'amount', label: 'Amount', type: 'number' as const }
    ];

    const TestSearchComponent = () => {
      const { searchState, updateQuery, addFilter } = useAdvancedSearch();
      
      return (
        <div>
          <div data-testid="query">{searchState.query}</div>
          <div data-testid="filters-count">{searchState.filters.length}</div>
          <button onClick={() => updateQuery('test query')}>Update Query</button>
          <button onClick={() => addFilter({
            id: 'test-filter',
            field: 'name',
            operator: 'contains',
            value: 'test',
            label: 'Name',
            type: 'text'
          })}>Add Filter</button>
        </div>
      );
    };

    beforeEach(() => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          results: [],
          total: 0,
          suggestions: []
        })
      });
    });

    it('should provide search context', () => {
      render(
        <AdvancedSearchProvider module="test" searchEndpoint={mockSearchEndpoint}>
          <TestSearchComponent />
        </AdvancedSearchProvider>
      );

      expect(screen.getByTestId('query')).toHaveTextContent('');
      expect(screen.getByTestId('filters-count')).toHaveTextContent('0');
    });

    it('should update search query', async () => {
      render(
        <AdvancedSearchProvider module="test" searchEndpoint={mockSearchEndpoint}>
          <TestSearchComponent />
        </AdvancedSearchProvider>
      );

      const updateButton = screen.getByText('Update Query');
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(screen.getByTestId('query')).toHaveTextContent('test query');
      });
    });

    it('should add and manage filters', async () => {
      render(
        <AdvancedSearchProvider module="test" searchEndpoint={mockSearchEndpoint}>
          <TestSearchComponent />
        </AdvancedSearchProvider>
      );

      const addFilterButton = screen.getByText('Add Filter');
      fireEvent.click(addFilterButton);

      await waitFor(() => {
        expect(screen.getByTestId('filters-count')).toHaveTextContent('1');
      });
    });

    it('should render search interface with all controls', () => {
      render(
        <AdvancedSearchProvider module="test" searchEndpoint={mockSearchEndpoint}>
          <AdvancedSearchInterface availableFields={mockFields} />
        </AdvancedSearchProvider>
      );

      expect(screen.getByText('Advanced Search')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
      expect(screen.getByText('Add Filter')).toBeInTheDocument();
      expect(screen.getByText('Save Search')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
    });

    it('should perform debounced search', async () => {
      jest.useFakeTimers();
      
      render(
        <AdvancedSearchProvider module="test" searchEndpoint={mockSearchEndpoint}>
          <AdvancedSearchInterface availableFields={mockFields} />
        </AdvancedSearchProvider>
      );

      const searchInput = screen.getByPlaceholderText('Search...');
      await userEvent.type(searchInput, 'test');

      // Fast-forward time to trigger debounced search
      jest.advanceTimersByTime(300);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(mockSearchEndpoint, expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test')
        }));
      });

      jest.useRealTimers();
    });
  });

  describe('User Preferences Management', () => {
    const TestPreferencesComponent = () => {
      const { preferences, updatePreferences } = useUserPreferences();
      
      return (
        <div>
          <div data-testid="theme">{preferences.theme}</div>
          <button onClick={() => updatePreferences({ theme: 'dark' })}>
            Set Dark Theme
          </button>
        </div>
      );
    };

    beforeEach(() => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });
    });

    it('should provide preferences context', () => {
      render(
        <UserPreferencesProvider>
          <TestPreferencesComponent />
        </UserPreferencesProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('system');
    });

    it('should update preferences', async () => {
      render(
        <UserPreferencesProvider>
          <TestPreferencesComponent />
        </UserPreferencesProvider>
      );

      const setThemeButton = screen.getByText('Set Dark Theme');
      fireEvent.click(setThemeButton);

      await waitFor(() => {
        expect(screen.getByTestId('theme')).toHaveTextContent('dark');
      });
    });

    it('should render preferences panel with all sections', () => {
      render(
        <UserPreferencesProvider>
          <UserPreferencesPanel />
        </UserPreferencesProvider>
      );

      expect(screen.getByText('User Preferences')).toBeInTheDocument();
      expect(screen.getByText('Display')).toBeInTheDocument();
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('Tables')).toBeInTheDocument();
      expect(screen.getByText('Search')).toBeInTheDocument();
      expect(screen.getByText('Accessibility')).toBeInTheDocument();
      expect(screen.getByText('Maritime')).toBeInTheDocument();
      expect(screen.getByText('Privacy')).toBeInTheDocument();
    });

    it('should save preferences to localStorage and server', async () => {
      render(
        <UserPreferencesProvider>
          <TestPreferencesComponent />
        </UserPreferencesProvider>
      );

      const setThemeButton = screen.getByText('Set Dark Theme');
      fireEvent.click(setThemeButton);

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'user-preferences',
          expect.stringContaining('dark')
        );
        expect(fetch).toHaveBeenCalledWith('/api/user/preferences', expect.objectContaining({
          method: 'PUT'
        }));
      });
    });
  });

  describe('Notification and Alert Management', () => {
    const TestNotificationComponent = () => {
      const { notifications, addNotification, unreadCount } = useNotifications();
      
      return (
        <div>
          <div data-testid="unread-count">{unreadCount}</div>
          <button onClick={() => addNotification({
            type: 'info',
            category: 'general',
            title: 'Test Notification',
            message: 'This is a test',
            priority: 'medium'
          })}>
            Add Notification
          </button>
        </div>
      );
    };

    it('should provide notification context', () => {
      render(
        <UserPreferencesProvider>
          <NotificationProvider>
            <TestNotificationComponent />
          </NotificationProvider>
        </UserPreferencesProvider>
      );

      expect(screen.getByTestId('unread-count')).toHaveTextContent('0');
    });

    it('should add notifications', async () => {
      render(
        <UserPreferencesProvider>
          <NotificationProvider>
            <TestNotificationComponent />
          </NotificationProvider>
        </UserPreferencesProvider>
      );

      const addButton = screen.getByText('Add Notification');
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('unread-count')).toHaveTextContent('1');
      });
    });

    it('should render notification center with all features', () => {
      render(
        <UserPreferencesProvider>
          <NotificationProvider>
            <NotificationCenter />
          </NotificationProvider>
        </UserPreferencesProvider>
      );

      expect(screen.getByText('Notification Center')).toBeInTheDocument();
      expect(screen.getByText('Filter')).toBeInTheDocument();
      expect(screen.getByText('Mark All Read')).toBeInTheDocument();
      expect(screen.getByText('Clear All')).toBeInTheDocument();
      expect(screen.getByText('Rules')).toBeInTheDocument();
    });

    it('should request notification permission', async () => {
      render(
        <UserPreferencesProvider>
          <NotificationProvider>
            <NotificationCenter />
          </NotificationProvider>
        </UserPreferencesProvider>
      );

      // Mock permission not granted initially
      Object.defineProperty(Notification, 'permission', {
        value: 'default',
        writable: true
      });

      const enableButton = screen.getByText('Enable Notifications');
      fireEvent.click(enableButton);

      expect(Notification.requestPermission).toHaveBeenCalled();
    });
  });

  describe('Help System and Documentation', () => {
    const TestHelpComponent = () => {
      const { articles, searchArticles } = useHelp();
      
      return (
        <div>
          <div data-testid="articles-count">{articles.length}</div>
          <button onClick={() => {
            const results = searchArticles('getting started');
            console.log('Search results:', results.length);
          }}>
            Search Articles
          </button>
        </div>
      );
    };

    beforeEach(() => {
      (fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('/api/help/articles')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve([])
          });
        }
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve([])
        });
      });
    });

    it('should provide help context with default content', async () => {
      render(
        <HelpProvider>
          <TestHelpComponent />
        </HelpProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('articles-count')).toHaveTextContent('2');
      });
    });

    it('should render help center with all sections', async () => {
      render(
        <HelpProvider>
          <HelpCenter />
        </HelpProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('FlowMarine Help Center')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search help articles...')).toBeInTheDocument();
        expect(screen.getByText('Quick Start')).toBeInTheDocument();
        expect(screen.getByText('Categories')).toBeInTheDocument();
        expect(screen.getByText('Popular Articles')).toBeInTheDocument();
      });
    });

    it('should search articles', async () => {
      render(
        <HelpProvider>
          <HelpCenter />
        </HelpProvider>
      );

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search help articles...');
        fireEvent.change(searchInput, { target: { value: 'getting started' } });
      });

      await waitFor(() => {
        expect(screen.getByText('Search Results')).toBeInTheDocument();
      });
    });

    it('should display article content when clicked', async () => {
      render(
        <HelpProvider>
          <HelpCenter />
        </HelpProvider>
      );

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search help articles...');
        fireEvent.change(searchInput, { target: { value: 'getting started' } });
      });

      await waitFor(() => {
        const articleCard = screen.getByText('Getting Started with FlowMarine');
        fireEvent.click(articleCard);
      });

      await waitFor(() => {
        expect(screen.getByText('Was this article helpful?')).toBeInTheDocument();
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work together - accessibility with preferences', () => {
      render(
        <UserPreferencesProvider>
          <AccessibilityProvider>
            <AccessibilityPanel />
          </AccessibilityProvider>
        </UserPreferencesProvider>
      );

      expect(screen.getByText('Accessibility Settings')).toBeInTheDocument();
      
      const highContrastSwitch = screen.getByRole('switch', { name: /high contrast/i });
      fireEvent.click(highContrastSwitch);

      expect(document.documentElement).toHaveClass('high-contrast');
    });

    it('should work together - search with notifications', async () => {
      render(
        <UserPreferencesProvider>
          <NotificationProvider>
            <AdvancedSearchProvider module="test" searchEndpoint="/api/search">
              <AdvancedSearchInterface availableFields={[]} />
            </AdvancedSearchProvider>
          </NotificationProvider>
        </UserPreferencesProvider>
      );

      expect(screen.getByText('Advanced Search')).toBeInTheDocument();
    });

    it('should maintain state across component unmounts', () => {
      const { rerender } = render(
        <AccessibilityProvider>
          <AccessibilityPanel />
        </AccessibilityProvider>
      );

      const highContrastSwitch = screen.getByRole('switch', { name: /high contrast/i });
      fireEvent.click(highContrastSwitch);

      rerender(
        <AccessibilityProvider>
          <AccessibilityPanel />
        </AccessibilityProvider>
      );

      expect(document.documentElement).toHaveClass('high-contrast');
    });
  });

  describe('Performance and Optimization', () => {
    it('should debounce search queries', async () => {
      jest.useFakeTimers();
      
      render(
        <AdvancedSearchProvider module="test" searchEndpoint="/api/search">
          <AdvancedSearchInterface availableFields={[]} />
        </AdvancedSearchProvider>
      );

      const searchInput = screen.getByPlaceholderText('Search...');
      
      // Type multiple characters quickly
      await userEvent.type(searchInput, 'test');
      
      // Should not have called fetch yet
      expect(fetch).not.toHaveBeenCalled();
      
      // Fast-forward past debounce delay
      jest.advanceTimersByTime(300);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledTimes(1);
      });

      jest.useRealTimers();
    });

    it('should cache search results', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        query: 'test',
        filters: [],
        sort: [],
        page: 1,
        pageSize: 25,
        totalResults: 0,
        isLoading: false,
        results: [],
        suggestions: [],
        recentSearches: ['test'],
        savedSearches: []
      }));

      render(
        <AdvancedSearchProvider module="test" searchEndpoint="/api/search">
          <AdvancedSearchInterface availableFields={[]} />
        </AdvancedSearchProvider>
      );

      expect(localStorageMock.getItem).toHaveBeenCalledWith('search-state-test');
    });
  });
});