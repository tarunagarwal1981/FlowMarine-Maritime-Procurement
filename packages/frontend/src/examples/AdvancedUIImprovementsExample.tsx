import React, { useState } from 'react';
import { AccessibilityProvider } from '../components/accessibility/AccessibilityProvider';
import { AccessibilityPanel } from '../components/accessibility/AccessibilityPanel';
import { AdvancedSearchProvider } from '../components/search/AdvancedSearchProvider';
import { AdvancedSearchInterface } from '../components/search/AdvancedSearchInterface';
import { UserPreferencesProvider } from '../components/preferences/UserPreferencesProvider';
import { UserPreferencesPanel } from '../components/preferences/UserPreferencesPanel';
import { NotificationProvider } from '../components/notifications/NotificationProvider';
import { NotificationCenter } from '../components/notifications/NotificationCenter';
import { HelpProvider } from '../components/help/HelpProvider';
import { HelpCenter } from '../components/help/HelpCenter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import '../styles/accessibility.css';

// Mock search fields for demonstration
const searchFields = [
  {
    field: 'requisitionNumber',
    label: 'Requisition Number',
    type: 'text' as const
  },
  {
    field: 'vesselName',
    label: 'Vessel Name',
    type: 'text' as const
  },
  {
    field: 'status',
    label: 'Status',
    type: 'select' as const,
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'pending', label: 'Pending Approval' },
      { value: 'approved', label: 'Approved' },
      { value: 'rejected', label: 'Rejected' }
    ]
  },
  {
    field: 'urgencyLevel',
    label: 'Urgency Level',
    type: 'select' as const,
    options: [
      { value: 'routine', label: 'Routine' },
      { value: 'urgent', label: 'Urgent' },
      { value: 'emergency', label: 'Emergency' }
    ]
  },
  {
    field: 'createdDate',
    label: 'Created Date',
    type: 'date' as const
  },
  {
    field: 'totalAmount',
    label: 'Total Amount',
    type: 'number' as const
  },
  {
    field: 'isApproved',
    label: 'Is Approved',
    type: 'boolean' as const
  }
];

const AdvancedUIImprovementsExample: React.FC = () => {
  const [activeTab, setActiveTab] = useState('accessibility');

  return (
    <UserPreferencesProvider>
      <AccessibilityProvider>
        <NotificationProvider>
          <HelpProvider>
            <div className="min-h-screen bg-background p-6">
              <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-2xl">
                      FlowMarine Advanced UI Improvements Demo
                    </CardTitle>
                    <p className="text-muted-foreground">
                      Comprehensive demonstration of WCAG 2.1 AA accessibility features, 
                      advanced search capabilities, user preferences, notifications, and help system.
                    </p>
                  </CardHeader>
                </Card>

                {/* Main Content */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
                    <TabsTrigger value="search">Advanced Search</TabsTrigger>
                    <TabsTrigger value="preferences">User Preferences</TabsTrigger>
                    <TabsTrigger value="notifications">Notifications</TabsTrigger>
                    <TabsTrigger value="help">Help System</TabsTrigger>
                  </TabsList>

                  {/* Accessibility Tab */}
                  <TabsContent value="accessibility" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>WCAG 2.1 AA Accessibility Features</CardTitle>
                        <p className="text-muted-foreground">
                          Comprehensive accessibility controls including high contrast mode, 
                          large text, reduced motion, color blind support, and enhanced keyboard navigation.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <AccessibilityPanel />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Accessibility Features Demonstration</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h3 className="font-medium">Screen Reader Support</h3>
                            <p className="text-sm text-muted-foreground">
                              All interactive elements have proper ARIA labels and descriptions.
                            </p>
                            <Button aria-describedby="sr-demo-desc">
                              Screen Reader Friendly Button
                            </Button>
                            <p id="sr-demo-desc" className="sr-only">
                              This button demonstrates proper screen reader support with ARIA descriptions.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <h3 className="font-medium">Keyboard Navigation</h3>
                            <p className="text-sm text-muted-foreground">
                              All functionality is accessible via keyboard with visible focus indicators.
                            </p>
                            <div className="flex gap-2">
                              <Button tabIndex={0}>First</Button>
                              <Button tabIndex={0}>Second</Button>
                              <Button tabIndex={0}>Third</Button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h3 className="font-medium">Touch Targets</h3>
                            <p className="text-sm text-muted-foreground">
                              All interactive elements meet the minimum 44px touch target size.
                            </p>
                            <Button className="min-h-[44px] min-w-[44px]">
                              44px Target
                            </Button>
                          </div>

                          <div className="space-y-2">
                            <h3 className="font-medium">Color Contrast</h3>
                            <p className="text-sm text-muted-foreground">
                              All text meets WCAG AA contrast requirements (4.5:1 for normal text).
                            </p>
                            <div className="p-3 bg-muted rounded">
                              <p className="text-foreground">High contrast text example</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Advanced Search Tab */}
                  <TabsContent value="search" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Advanced Search and Filtering</CardTitle>
                        <p className="text-muted-foreground">
                          Powerful search capabilities with filters, sorting, saved searches, 
                          and export functionality across all FlowMarine modules.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <AdvancedSearchProvider 
                          module="requisitions" 
                          searchEndpoint="/api/requisitions/search"
                        >
                          <AdvancedSearchInterface 
                            availableFields={searchFields}
                            placeholder="Search requisitions, vessels, vendors..."
                          />
                        </AdvancedSearchProvider>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Search Features</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <h3 className="font-medium">Dynamic Filters</h3>
                            <p className="text-sm text-muted-foreground">
                              Add multiple filters with different operators based on field types.
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <h3 className="font-medium">Saved Searches</h3>
                            <p className="text-sm text-muted-foreground">
                              Save frequently used search criteria for quick access.
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <h3 className="font-medium">Export Results</h3>
                            <p className="text-sm text-muted-foreground">
                              Export search results to CSV, Excel, or PDF formats.
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <h3 className="font-medium">Real-time Search</h3>
                            <p className="text-sm text-muted-foreground">
                              Debounced search with instant results and suggestions.
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <h3 className="font-medium">Search History</h3>
                            <p className="text-sm text-muted-foreground">
                              Access recent searches and search suggestions.
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <h3 className="font-medium">Advanced Sorting</h3>
                            <p className="text-sm text-muted-foreground">
                              Multi-column sorting with drag-and-drop reordering.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* User Preferences Tab */}
                  <TabsContent value="preferences" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>User Preferences and Personalization</CardTitle>
                        <p className="text-muted-foreground">
                          Comprehensive user preference management with theme, language, 
                          notifications, accessibility, and maritime-specific settings.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <UserPreferencesPanel />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Notifications Tab */}
                  <TabsContent value="notifications" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Advanced Notification Management</CardTitle>
                        <p className="text-muted-foreground">
                          Intelligent notification system with rules, filtering, 
                          priority management, and multi-channel delivery.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <NotificationCenter />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Notification Features</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h3 className="font-medium">Smart Rules</h3>
                            <p className="text-sm text-muted-foreground">
                              Create custom notification rules based on category, priority, keywords, and time.
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <h3 className="font-medium">Multi-Channel Delivery</h3>
                            <p className="text-sm text-muted-foreground">
                              Desktop notifications, email alerts, push notifications, and in-app messages.
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <h3 className="font-medium">Priority Management</h3>
                            <p className="text-sm text-muted-foreground">
                              Critical, high, medium, and low priority notifications with appropriate handling.
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <h3 className="font-medium">Maritime Categories</h3>
                            <p className="text-sm text-muted-foreground">
                              Specialized categories for requisitions, orders, budgets, security, and maintenance.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Help System Tab */}
                  <TabsContent value="help" className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Comprehensive Help System</CardTitle>
                        <p className="text-muted-foreground">
                          Interactive help center with searchable articles, guided tours, 
                          video tutorials, and contextual assistance.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <HelpCenter />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>

                {/* Footer */}
                <Card>
                  <CardContent className="p-4">
                    <div className="text-center text-sm text-muted-foreground">
                      <p>
                        This demonstration showcases FlowMarine's advanced UI improvements 
                        implementing WCAG 2.1 AA accessibility standards, comprehensive search capabilities, 
                        user personalization, intelligent notifications, and contextual help system.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </HelpProvider>
        </NotificationProvider>
      </AccessibilityProvider>
    </UserPreferencesProvider>
  );
};

export default AdvancedUIImprovementsExample;