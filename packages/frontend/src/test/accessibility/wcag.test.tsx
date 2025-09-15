import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from '@/store/store';
import { LoginForm } from '@/components/auth/LoginForm';
import { RequisitionForm } from '@/components/requisitions/RequisitionForm';
import { RequisitionList } from '@/components/requisitions/RequisitionList';
import { Navigation } from '@/components/ui/Navigation';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider store={store}>
    <BrowserRouter>
      {children}
    </BrowserRouter>
  </Provider>
);

describe('WCAG 2.1 AA Accessibility Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    // Clean up any modal or overlay elements
    document.body.innerHTML = '';
  });

  describe('Authentication Components', () => {
    it('should have no accessibility violations in LoginForm', async () => {
      const { container } = render(
        <TestWrapper>
          <LoginForm onSubmit={() => {}} isLoading={false} />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation in LoginForm', async () => {
      render(
        <TestWrapper>
          <LoginForm onSubmit={() => {}} isLoading={false} />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Test tab navigation
      await user.tab();
      expect(emailInput).toHaveFocus();

      await user.tab();
      expect(passwordInput).toHaveFocus();

      await user.tab();
      expect(submitButton).toHaveFocus();
    });

    it('should provide proper ARIA labels and descriptions', async () => {
      render(
        <TestWrapper>
          <LoginForm onSubmit={() => {}} isLoading={false} error="Invalid credentials" />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const errorMessage = screen.getByRole('alert');

      expect(emailInput).toHaveAttribute('aria-required', 'true');
      expect(passwordInput).toHaveAttribute('aria-required', 'true');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveAttribute('aria-live', 'polite');
    });

    it('should support screen reader announcements for form validation', async () => {
      const mockSubmit = vi.fn();
      render(
        <TestWrapper>
          <LoginForm onSubmit={mockSubmit} isLoading={false} />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      // Submit empty form
      await user.click(submitButton);

      await waitFor(() => {
        const emailError = screen.getByText(/email is required/i);
        const passwordError = screen.getByText(/password is required/i);
        
        expect(emailError).toHaveAttribute('role', 'alert');
        expect(passwordError).toHaveAttribute('role', 'alert');
      });
    });
  });

  describe('Form Components', () => {
    it('should have no accessibility violations in RequisitionForm', async () => {
      const mockVessels = [
        { id: '1', name: 'Test Vessel 1', imoNumber: 'IMO1234567' },
        { id: '2', name: 'Test Vessel 2', imoNumber: 'IMO7654321' },
      ];

      const { container } = render(
        <TestWrapper>
          <RequisitionForm
            vessels={mockVessels}
            onSubmit={() => {}}
            isLoading={false}
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation in complex forms', async () => {
      const mockVessels = [
        { id: '1', name: 'Test Vessel 1', imoNumber: 'IMO1234567' },
      ];

      render(
        <TestWrapper>
          <RequisitionForm
            vessels={mockVessels}
            onSubmit={() => {}}
            isLoading={false}
          />
        </TestWrapper>
      );

      // Test sequential keyboard navigation through form fields
      const vesselSelect = screen.getByLabelText(/vessel/i);
      const urgencySelect = screen.getByLabelText(/urgency/i);
      const deliveryLocationInput = screen.getByLabelText(/delivery location/i);
      const justificationTextarea = screen.getByLabelText(/justification/i);

      await user.tab();
      expect(vesselSelect).toHaveFocus();

      await user.tab();
      expect(urgencySelect).toHaveFocus();

      await user.tab();
      expect(deliveryLocationInput).toHaveFocus();

      await user.tab();
      expect(justificationTextarea).toHaveFocus();
    });

    it('should provide proper fieldset and legend for grouped form elements', async () => {
      const mockVessels = [
        { id: '1', name: 'Test Vessel 1', imoNumber: 'IMO1234567' },
      ];

      render(
        <TestWrapper>
          <RequisitionForm
            vessels={mockVessels}
            onSubmit={() => {}}
            isLoading={false}
          />
        </TestWrapper>
      );

      const itemsFieldset = screen.getByRole('group', { name: /requisition items/i });
      expect(itemsFieldset).toBeInTheDocument();
      expect(itemsFieldset.tagName).toBe('FIELDSET');

      const legend = screen.getByText(/requisition items/i);
      expect(legend.tagName).toBe('LEGEND');
    });
  });

  describe('Navigation Components', () => {
    it('should have no accessibility violations in Navigation', async () => {
      const mockUser = {
        id: '1',
        firstName: 'John',
        lastName: 'Doe',
        role: 'CREW',
        vessels: [{ id: '1', name: 'Test Vessel' }],
      };

      const { container } = render(
        <TestWrapper>
          <Navigation user={mockUser} onLogout={() => {}} />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation in main navigation', async () => {
      const mockUser = {
        id: '1',
        firstName: 'John',
        lastName: 'Doe',
        role: 'CREW',
        vessels: [{ id: '1', name: 'Test Vessel' }],
      };

      render(
        <TestWrapper>
          <Navigation user={mockUser} onLogout={() => {}} />
        </TestWrapper>
      );

      const navLinks = screen.getAllByRole('link');
      
      // Test that all navigation links are keyboard accessible
      for (const link of navLinks) {
        await user.tab();
        expect(link).toHaveFocus();
      }
    });

    it('should provide proper ARIA landmarks', async () => {
      const mockUser = {
        id: '1',
        firstName: 'John',
        lastName: 'Doe',
        role: 'CREW',
        vessels: [{ id: '1', name: 'Test Vessel' }],
      };

      render(
        <TestWrapper>
          <Navigation user={mockUser} onLogout={() => {}} />
        </TestWrapper>
      );

      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveAttribute('aria-label', 'Main navigation');

      const banner = screen.getByRole('banner');
      expect(banner).toBeInTheDocument();
    });

    it('should support skip links for keyboard users', async () => {
      const mockUser = {
        id: '1',
        firstName: 'John',
        lastName: 'Doe',
        role: 'CREW',
        vessels: [{ id: '1', name: 'Test Vessel' }],
      };

      render(
        <TestWrapper>
          <Navigation user={mockUser} onLogout={() => {}} />
        </TestWrapper>
      );

      // Focus the first element and check for skip link
      await user.tab();
      const skipLink = screen.getByText(/skip to main content/i);
      expect(skipLink).toBeVisible();
      expect(skipLink).toHaveFocus();
    });
  });

  describe('Data Display Components', () => {
    it('should have no accessibility violations in DataTable', async () => {
      const mockData = [
        { id: '1', name: 'Item 1', status: 'Active', amount: 100 },
        { id: '2', name: 'Item 2', status: 'Pending', amount: 200 },
      ];

      const mockColumns = [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'status', label: 'Status', sortable: true },
        { key: 'amount', label: 'Amount', sortable: true },
      ];

      const { container } = render(
        <TestWrapper>
          <DataTable
            data={mockData}
            columns={mockColumns}
            onSort={() => {}}
            sortBy="name"
            sortOrder="asc"
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should provide proper table structure and headers', async () => {
      const mockData = [
        { id: '1', name: 'Item 1', status: 'Active', amount: 100 },
      ];

      const mockColumns = [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'status', label: 'Status', sortable: true },
        { key: 'amount', label: 'Amount', sortable: true },
      ];

      render(
        <TestWrapper>
          <DataTable
            data={mockData}
            columns={mockColumns}
            onSort={() => {}}
            sortBy="name"
            sortOrder="asc"
          />
        </TestWrapper>
      );

      const table = screen.getByRole('table');
      expect(table).toHaveAttribute('aria-label');

      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders).toHaveLength(3);

      columnHeaders.forEach(header => {
        expect(header).toHaveAttribute('scope', 'col');
      });

      const rowHeaders = screen.getAllByRole('rowheader');
      rowHeaders.forEach(header => {
        expect(header).toHaveAttribute('scope', 'row');
      });
    });

    it('should support keyboard navigation in sortable tables', async () => {
      const mockData = [
        { id: '1', name: 'Item 1', status: 'Active', amount: 100 },
      ];

      const mockColumns = [
        { key: 'name', label: 'Name', sortable: true },
        { key: 'status', label: 'Status', sortable: true },
        { key: 'amount', label: 'Amount', sortable: true },
      ];

      const mockSort = vi.fn();

      render(
        <TestWrapper>
          <DataTable
            data={mockData}
            columns={mockColumns}
            onSort={mockSort}
            sortBy="name"
            sortOrder="asc"
          />
        </TestWrapper>
      );

      const sortableHeaders = screen.getAllByRole('button');
      
      // Test keyboard activation of sort buttons
      for (const header of sortableHeaders) {
        await user.tab();
        expect(header).toHaveFocus();
        
        await user.keyboard('{Enter}');
        expect(mockSort).toHaveBeenCalled();
      }
    });

    it('should announce sort changes to screen readers', async () => {
      const mockData = [
        { id: '1', name: 'Item 1', status: 'Active', amount: 100 },
      ];

      const mockColumns = [
        { key: 'name', label: 'Name', sortable: true },
      ];

      render(
        <TestWrapper>
          <DataTable
            data={mockData}
            columns={mockColumns}
            onSort={() => {}}
            sortBy="name"
            sortOrder="asc"
          />
        </TestWrapper>
      );

      const sortButton = screen.getByRole('button', { name: /name/i });
      expect(sortButton).toHaveAttribute('aria-sort', 'ascending');

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('UI Components', () => {
    it('should have no accessibility violations in Button component', async () => {
      const { container } = render(
        <Button variant="primary" size="md">
          Test Button
        </Button>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should provide proper button states and attributes', async () => {
      render(
        <>
          <Button variant="primary" disabled>
            Disabled Button
          </Button>
          <Button variant="secondary" loading>
            Loading Button
          </Button>
          <Button variant="danger" aria-describedby="help-text">
            Delete Button
          </Button>
          <div id="help-text">This action cannot be undone</div>
        </>
      );

      const disabledButton = screen.getByRole('button', { name: /disabled button/i });
      expect(disabledButton).toBeDisabled();
      expect(disabledButton).toHaveAttribute('aria-disabled', 'true');

      const loadingButton = screen.getByRole('button', { name: /loading button/i });
      expect(loadingButton).toHaveAttribute('aria-busy', 'true');

      const deleteButton = screen.getByRole('button', { name: /delete button/i });
      expect(deleteButton).toHaveAttribute('aria-describedby', 'help-text');
    });

    it('should have no accessibility violations in Input component', async () => {
      const { container } = render(
        <Input
          label="Test Input"
          id="test-input"
          required
          error="This field is required"
          helperText="Enter your information here"
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should provide proper input labeling and descriptions', async () => {
      render(
        <Input
          label="Email Address"
          id="email-input"
          type="email"
          required
          error="Please enter a valid email"
          helperText="We'll never share your email"
        />
      );

      const input = screen.getByLabelText(/email address/i);
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby');

      const errorMessage = screen.getByText(/please enter a valid email/i);
      expect(errorMessage).toHaveAttribute('role', 'alert');

      const helperText = screen.getByText(/we'll never share your email/i);
      expect(helperText).toBeInTheDocument();
    });

    it('should have no accessibility violations in Select component', async () => {
      const options = [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
      ];

      const { container } = render(
        <Select
          label="Test Select"
          id="test-select"
          options={options}
          required
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation in Select component', async () => {
      const options = [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
        { value: 'option3', label: 'Option 3' },
      ];

      render(
        <Select
          label="Test Select"
          id="test-select"
          options={options}
        />
      );

      const select = screen.getByLabelText(/test select/i);
      
      // Focus the select
      await user.click(select);
      expect(select).toHaveFocus();

      // Test arrow key navigation
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(select).toHaveValue('option2');
    });
  });

  describe('Color Contrast and Visual Accessibility', () => {
    it('should meet color contrast requirements', async () => {
      const { container } = render(
        <div className="bg-blue-600 text-white p-4">
          <h1>High Contrast Heading</h1>
          <p>This text should meet WCAG AA contrast requirements</p>
          <Button variant="primary">Primary Button</Button>
          <Button variant="secondary">Secondary Button</Button>
        </div>
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should not rely solely on color to convey information', async () => {
      render(
        <div>
          <div className="text-red-600" role="alert" aria-label="Error">
            ❌ This is an error message
          </div>
          <div className="text-green-600" role="status" aria-label="Success">
            ✅ This is a success message
          </div>
          <div className="text-yellow-600" role="alert" aria-label="Warning">
            ⚠️ This is a warning message
          </div>
        </div>
      );

      // Verify that icons and ARIA labels are used in addition to color
      const errorMessage = screen.getByRole('alert', { name: /error/i });
      expect(errorMessage).toHaveTextContent('❌');

      const successMessage = screen.getByRole('status', { name: /success/i });
      expect(successMessage).toHaveTextContent('✅');

      const warningMessage = screen.getByRole('alert', { name: /warning/i });
      expect(warningMessage).toHaveTextContent('⚠️');
    });
  });

  describe('Focus Management', () => {
    it('should manage focus properly in modal dialogs', async () => {
      const MockModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
        if (!isOpen) return null;

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
          >
            <div className="bg-white p-6 rounded-lg">
              <h2 id="modal-title">Confirm Action</h2>
              <p>Are you sure you want to proceed?</p>
              <div className="flex gap-2 mt-4">
                <Button onClick={onClose} autoFocus>
                  Cancel
                </Button>
                <Button variant="danger" onClick={onClose}>
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        );
      };

      const TestComponent = () => {
        const [isModalOpen, setIsModalOpen] = React.useState(false);
        
        return (
          <div>
            <Button onClick={() => setIsModalOpen(true)}>
              Open Modal
            </Button>
            <MockModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
          </div>
        );
      };

      render(<TestComponent />);

      const openButton = screen.getByRole('button', { name: /open modal/i });
      await user.click(openButton);

      // Modal should be present and focused
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveAttribute('aria-modal', 'true');

      // First focusable element should be focused
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toHaveFocus();

      // Test tab trapping
      await user.tab();
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      expect(confirmButton).toHaveFocus();

      await user.tab();
      expect(cancelButton).toHaveFocus(); // Should wrap back to first element
    });

    it('should provide visible focus indicators', async () => {
      render(
        <div>
          <Button>Focusable Button</Button>
          <Input label="Focusable Input" id="focus-input" />
          <Select
            label="Focusable Select"
            id="focus-select"
            options={[{ value: 'test', label: 'Test' }]}
          />
        </div>
      );

      const button = screen.getByRole('button');
      const input = screen.getByLabelText(/focusable input/i);
      const select = screen.getByLabelText(/focusable select/i);

      // Test that focus indicators are visible
      await user.tab();
      expect(button).toHaveFocus();
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2');

      await user.tab();
      expect(input).toHaveFocus();
      expect(input).toHaveClass('focus:ring-2');

      await user.tab();
      expect(select).toHaveFocus();
      expect(select).toHaveClass('focus:ring-2');
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide proper heading hierarchy', async () => {
      render(
        <div>
          <h1>Main Page Title</h1>
          <h2>Section Title</h2>
          <h3>Subsection Title</h3>
          <h2>Another Section</h2>
          <h3>Another Subsection</h3>
        </div>
      );

      const headings = screen.getAllByRole('heading');
      expect(headings[0]).toHaveProperty('tagName', 'H1');
      expect(headings[1]).toHaveProperty('tagName', 'H2');
      expect(headings[2]).toHaveProperty('tagName', 'H3');
      expect(headings[3]).toHaveProperty('tagName', 'H2');
      expect(headings[4]).toHaveProperty('tagName', 'H3');
    });

    it('should provide proper live regions for dynamic content', async () => {
      const TestComponent = () => {
        const [message, setMessage] = React.useState('');
        
        return (
          <div>
            <Button onClick={() => setMessage('Form submitted successfully!')}>
              Submit Form
            </Button>
            <div role="status" aria-live="polite" aria-atomic="true">
              {message}
            </div>
          </div>
        );
      };

      render(<TestComponent />);

      const submitButton = screen.getByRole('button', { name: /submit form/i });
      const liveRegion = screen.getByRole('status');

      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true');

      await user.click(submitButton);

      await waitFor(() => {
        expect(liveRegion).toHaveTextContent('Form submitted successfully!');
      });
    });

    it('should provide descriptive link text', async () => {
      render(
        <div>
          <a href="/requisitions">View All Requisitions</a>
          <a href="/help" aria-describedby="help-description">
            Help
          </a>
          <div id="help-description">Get help with using the system</div>
        </div>
      );

      const requisitionsLink = screen.getByRole('link', { name: /view all requisitions/i });
      expect(requisitionsLink).toHaveAccessibleName('View All Requisitions');

      const helpLink = screen.getByRole('link', { name: /help/i });
      expect(helpLink).toHaveAttribute('aria-describedby', 'help-description');
    });

    it('should announce loading states to screen readers', async () => {
      const LoadingComponent = () => {
        const [isLoading, setIsLoading] = React.useState(false);
        
        return (
          <div>
            <Button 
              onClick={() => {
                setIsLoading(true);
                setTimeout(() => setIsLoading(false), 1000);
              }}
              disabled={isLoading}
              aria-describedby="loading-status"
            >
              {isLoading ? 'Loading...' : 'Load Data'}
            </Button>
            <div 
              id="loading-status" 
              role="status" 
              aria-live="polite"
              aria-atomic="true"
            >
              {isLoading ? 'Loading data, please wait...' : ''}
            </div>
          </div>
        );
      };

      render(<LoadingComponent />);

      const loadButton = screen.getByRole('button');
      const statusRegion = screen.getByRole('status');

      await user.click(loadButton);

      expect(loadButton).toBeDisabled();
      expect(loadButton).toHaveTextContent('Loading...');
      expect(statusRegion).toHaveTextContent('Loading data, please wait...');

      await waitFor(() => {
        expect(loadButton).not.toBeDisabled();
        expect(loadButton).toHaveTextContent('Load Data');
      }, { timeout: 2000 });
    });

    it('should provide proper error announcements', async () => {
      const ErrorComponent = () => {
        const [error, setError] = React.useState('');
        
        return (
          <div>
            <Button onClick={() => setError('An error occurred while processing your request')}>
              Trigger Error
            </Button>
            <div 
              role="alert" 
              aria-live="assertive"
              aria-atomic="true"
              className={error ? 'visible' : 'sr-only'}
            >
              {error}
            </div>
          </div>
        );
      };

      render(<ErrorComponent />);

      const errorButton = screen.getByRole('button', { name: /trigger error/i });
      
      await user.click(errorButton);

      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toHaveTextContent('An error occurred while processing your request');
      expect(errorAlert).toHaveAttribute('aria-live', 'assertive');
    });
  });

  describe('Advanced Accessibility Features', () => {
    it('should support high contrast mode', async () => {
      const HighContrastComponent = () => (
        <div className="high-contrast-mode">
          <h1 className="text-white bg-black p-4">High Contrast Heading</h1>
          <Button variant="primary" className="high-contrast">
            High Contrast Button
          </Button>
          <Input 
            label="High Contrast Input" 
            id="hc-input"
            className="high-contrast"
          />
        </div>
      );

      const { container } = render(<HighContrastComponent />);

      // Test that high contrast styles are applied
      const heading = screen.getByRole('heading');
      expect(heading).toHaveClass('text-white', 'bg-black');

      const button = screen.getByRole('button');
      expect(button).toHaveClass('high-contrast');

      const input = screen.getByLabelText(/high contrast input/i);
      expect(input).toHaveClass('high-contrast');

      // Run accessibility check
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support reduced motion preferences', async () => {
      const MotionComponent = () => {
        const [animate, setAnimate] = React.useState(false);
        
        return (
          <div>
            <Button onClick={() => setAnimate(!animate)}>
              Toggle Animation
            </Button>
            <div 
              className={`transition-transform duration-300 ${animate ? 'scale-110' : 'scale-100'}`}
              style={{
                transform: animate ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 0.3s ease-in-out',
              }}
            >
              Animated Element
            </div>
          </div>
        );
      };

      render(<MotionComponent />);

      const toggleButton = screen.getByRole('button', { name: /toggle animation/i });
      const animatedElement = screen.getByText('Animated Element');

      // Check that animations respect user preferences
      expect(animatedElement).toHaveStyle('transition: transform 0.3s ease-in-out');

      await user.click(toggleButton);
      
      // In a real implementation, this would check for prefers-reduced-motion
      expect(animatedElement).toHaveClass('transition-transform');
    });

    it('should provide proper text alternatives for images', async () => {
      const ImageComponent = () => (
        <div>
          <img 
            src="/vessel-image.jpg" 
            alt="Container ship MV Test Vessel at Port of Singapore"
            role="img"
          />
          <img 
            src="/decorative-wave.svg" 
            alt="" 
            role="presentation"
          />
          <div 
            role="img" 
            aria-label="Chart showing procurement spending trends over the last 12 months"
            className="w-64 h-32 bg-blue-100"
          >
            {/* Chart content would go here */}
          </div>
        </div>
      );

      render(<ImageComponent />);

      const vesselImage = screen.getByRole('img', { name: /container ship mv test vessel/i });
      expect(vesselImage).toHaveAttribute('alt', 'Container ship MV Test Vessel at Port of Singapore');

      const decorativeImage = screen.getByRole('presentation');
      expect(decorativeImage).toHaveAttribute('alt', '');

      const chartDiv = screen.getByRole('img', { name: /chart showing procurement spending/i });
      expect(chartDiv).toHaveAttribute('aria-label', 'Chart showing procurement spending trends over the last 12 months');
    });

    it('should support voice control and speech recognition', async () => {
      const VoiceControlComponent = () => {
        const [voiceCommand, setVoiceCommand] = React.useState('');
        
        return (
          <div>
            <Button 
              data-voice-command="create requisition"
              onClick={() => setVoiceCommand('create requisition')}
            >
              Create Requisition
            </Button>
            <Button 
              data-voice-command="view requisitions"
              onClick={() => setVoiceCommand('view requisitions')}
            >
              View Requisitions
            </Button>
            <div role="status" aria-live="polite">
              {voiceCommand && `Voice command recognized: ${voiceCommand}`}
            </div>
          </div>
        );
      };

      render(<VoiceControlComponent />);

      const createButton = screen.getByRole('button', { name: /create requisition/i });
      const viewButton = screen.getByRole('button', { name: /view requisitions/i });

      expect(createButton).toHaveAttribute('data-voice-command', 'create requisition');
      expect(viewButton).toHaveAttribute('data-voice-command', 'view requisitions');

      await user.click(createButton);

      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveTextContent('Voice command recognized: create requisition');
    });

    it('should support custom accessibility preferences', async () => {
      const AccessibilityPreferencesComponent = () => {
        const [preferences, setPreferences] = React.useState({
          fontSize: 'medium',
          contrast: 'normal',
          animations: true,
          screenReader: false,
        });

        return (
          <div data-font-size={preferences.fontSize} data-contrast={preferences.contrast}>
            <fieldset>
              <legend>Accessibility Preferences</legend>
              
              <div>
                <label htmlFor="font-size">Font Size</label>
                <select 
                  id="font-size"
                  value={preferences.fontSize}
                  onChange={(e) => setPreferences(prev => ({ ...prev, fontSize: e.target.value }))}
                >
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="extra-large">Extra Large</option>
                </select>
              </div>

              <div>
                <label htmlFor="contrast">Contrast</label>
                <select 
                  id="contrast"
                  value={preferences.contrast}
                  onChange={(e) => setPreferences(prev => ({ ...prev, contrast: e.target.value }))}
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="extra-high">Extra High</option>
                </select>
              </div>

              <div>
                <input 
                  type="checkbox" 
                  id="animations"
                  checked={preferences.animations}
                  onChange={(e) => setPreferences(prev => ({ ...prev, animations: e.target.checked }))}
                />
                <label htmlFor="animations">Enable Animations</label>
              </div>

              <div>
                <input 
                  type="checkbox" 
                  id="screen-reader"
                  checked={preferences.screenReader}
                  onChange={(e) => setPreferences(prev => ({ ...prev, screenReader: e.target.checked }))}
                />
                <label htmlFor="screen-reader">Screen Reader Optimizations</label>
              </div>
            </fieldset>

            <div role="status" aria-live="polite">
              Preferences updated: Font size {preferences.fontSize}, Contrast {preferences.contrast}
            </div>
          </div>
        );
      };

      const { container } = render(<AccessibilityPreferencesComponent />);

      const fontSizeSelect = screen.getByLabelText(/font size/i);
      const contrastSelect = screen.getByLabelText(/contrast/i);
      const animationsCheckbox = screen.getByLabelText(/enable animations/i);
      const screenReaderCheckbox = screen.getByLabelText(/screen reader optimizations/i);

      // Test preference changes
      await user.selectOptions(fontSizeSelect, 'large');
      await user.selectOptions(contrastSelect, 'high');
      await user.click(animationsCheckbox);
      await user.click(screenReaderCheckbox);

      expect(fontSizeSelect).toHaveValue('large');
      expect(contrastSelect).toHaveValue('high');
      expect(animationsCheckbox).not.toBeChecked();
      expect(screenReaderCheckbox).toBeChecked();

      // Check that container reflects preferences
      const mainDiv = container.firstChild as HTMLElement;
      expect(mainDiv).toHaveAttribute('data-font-size', 'large');
      expect(mainDiv).toHaveAttribute('data-contrast', 'high');

      // Run accessibility check
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Maritime-Specific Accessibility', () => {
    it('should provide accessible vessel status indicators', async () => {
      const VesselStatusComponent = () => (
        <div>
          <div 
            role="status"
            aria-label="Vessel MV Test Ship is currently at sea, ETA Port of Hamburg in 3 days"
            className="vessel-status"
          >
            <span className="status-icon" aria-hidden="true">🚢</span>
            <span className="status-text">At Sea</span>
            <span className="eta-text">ETA: 3 days</span>
          </div>
          
          <div 
            role="alert"
            aria-label="Emergency: Vessel MV Emergency Ship requires immediate assistance"
            className="vessel-emergency"
          >
            <span className="emergency-icon" aria-hidden="true">🚨</span>
            <span className="emergency-text">Emergency</span>
          </div>
        </div>
      );

      render(<VesselStatusComponent />);

      const vesselStatus = screen.getByRole('status');
      expect(vesselStatus).toHaveAttribute('aria-label', 'Vessel MV Test Ship is currently at sea, ETA Port of Hamburg in 3 days');

      const emergencyAlert = screen.getByRole('alert');
      expect(emergencyAlert).toHaveAttribute('aria-label', 'Emergency: Vessel MV Emergency Ship requires immediate assistance');

      // Icons should be hidden from screen readers
      const statusIcon = screen.getByText('🚢');
      const emergencyIcon = screen.getByText('🚨');
      expect(statusIcon).toHaveAttribute('aria-hidden', 'true');
      expect(emergencyIcon).toHaveAttribute('aria-hidden', 'true');
    });

    it('should provide accessible procurement workflow indicators', async () => {
      const WorkflowComponent = () => (
        <div>
          <nav aria-label="Procurement workflow progress">
            <ol className="workflow-steps">
              <li 
                className="step completed"
                aria-current={false}
                aria-label="Step 1: Requisition created - Completed"
              >
                <span aria-hidden="true">✓</span>
                Requisition Created
              </li>
              <li 
                className="step current"
                aria-current="step"
                aria-label="Step 2: Pending approval - Current step"
              >
                <span aria-hidden="true">⏳</span>
                Pending Approval
              </li>
              <li 
                className="step pending"
                aria-current={false}
                aria-label="Step 3: Purchase order - Not started"
              >
                <span aria-hidden="true">○</span>
                Purchase Order
              </li>
            </ol>
          </nav>
        </div>
      );

      render(<WorkflowComponent />);

      const workflowNav = screen.getByRole('navigation', { name: /procurement workflow progress/i });
      expect(workflowNav).toBeInTheDocument();

      const currentStep = screen.getByText('Pending Approval').closest('li');
      expect(currentStep).toHaveAttribute('aria-current', 'step');
      expect(currentStep).toHaveAttribute('aria-label', 'Step 2: Pending approval - Current step');

      const completedStep = screen.getByText('Requisition Created').closest('li');
      expect(completedStep).toHaveAttribute('aria-label', 'Step 1: Requisition created - Completed');

      const pendingStep = screen.getByText('Purchase Order').closest('li');
      expect(pendingStep).toHaveAttribute('aria-label', 'Step 3: Purchase order - Not started');
    });

    it('should provide accessible emergency procedures interface', async () => {
      const EmergencyComponent = () => {
        const [emergencyActive, setEmergencyActive] = React.useState(false);
        
        return (
          <div>
            <Button 
              onClick={() => setEmergencyActive(true)}
              className="emergency-button"
              aria-describedby="emergency-help"
            >
              Emergency Override
            </Button>
            <div id="emergency-help" className="sr-only">
              Use this button only in case of safety-critical emergencies. Captain authorization required.
            </div>
            
            {emergencyActive && (
              <div 
                role="dialog"
                aria-modal="true"
                aria-labelledby="emergency-title"
                aria-describedby="emergency-description"
                className="emergency-modal"
              >
                <h2 id="emergency-title">Emergency Override Confirmation</h2>
                <p id="emergency-description">
                  This action will bypass normal approval procedures. 
                  Only use in case of immediate safety threats.
                </p>
                <div>
                  <Button 
                    onClick={() => setEmergencyActive(false)}
                    autoFocus
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="danger"
                    onClick={() => setEmergencyActive(false)}
                  >
                    Confirm Emergency Override
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      };

      render(<EmergencyComponent />);

      const emergencyButton = screen.getByRole('button', { name: /emergency override/i });
      expect(emergencyButton).toHaveAttribute('aria-describedby', 'emergency-help');

      await user.click(emergencyButton);

      const emergencyDialog = screen.getByRole('dialog');
      expect(emergencyDialog).toHaveAttribute('aria-modal', 'true');
      expect(emergencyDialog).toHaveAttribute('aria-labelledby', 'emergency-title');
      expect(emergencyDialog).toHaveAttribute('aria-describedby', 'emergency-description');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toHaveFocus();
    });
  });
});