import React, { useState } from 'react';
import { useUserPreferences } from './UserPreferencesProvider';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Badge } from '../ui/badge';
import { 
  Settings, 
  Palette, 
  Bell, 
  Table, 
  Search, 
  Eye, 
  Ship, 
  Shield, 
  Download, 
  Upload,
  RotateCcw,
  Save
} from 'lucide-react';

export const UserPreferencesPanel: React.FC = () => {
  const { 
    preferences, 
    updatePreferences, 
    resetPreferences, 
    exportPreferences, 
    importPreferences,
    isLoading,
    error 
  } = useUserPreferences();
  
  const [importFile, setImportFile] = useState<File | null>(null);

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const text = await file.text();
        const importedPrefs = JSON.parse(text);
        await importPreferences(importedPrefs);
        setImportFile(null);
        event.target.value = '';
      } catch (error) {
        console.error('Failed to import preferences:', error);
      }
    }
  };

  if (isLoading) {
    return <div>Loading preferences...</div>;
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            User Preferences
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportPreferences}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <div className="relative">
              <Button variant="outline" size="sm" asChild>
                <label htmlFor="import-preferences" className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </label>
              </Button>
              <input
                id="import-preferences"
                type="file"
                accept=".json"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleImportFile}
              />
            </div>
            <Button variant="outline" size="sm" onClick={resetPreferences}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="display" className="w-full">
            <TabsList className="grid w-full grid-cols-8">
              <TabsTrigger value="display">Display</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="tables">Tables</TabsTrigger>
              <TabsTrigger value="search">Search</TabsTrigger>
              <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
              <TabsTrigger value="maritime">Maritime</TabsTrigger>
              <TabsTrigger value="privacy">Privacy</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            {/* Display Preferences */}
            <TabsContent value="display" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Appearance
                  </h3>
                  
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <Select
                      value={preferences.theme}
                      onValueChange={(value) => updatePreferences({ theme: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select
                      value={preferences.language}
                      onValueChange={(value) => updatePreferences({ language: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="zh">Chinese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select
                      value={preferences.currency}
                      onValueChange={(value) => updatePreferences({ currency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                        <SelectItem value="CNY">CNY - Chinese Yuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Regional Settings</h3>
                  
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select
                      value={preferences.timezone}
                      onValueChange={(value) => updatePreferences({ timezone: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                        <SelectItem value="Europe/London">London</SelectItem>
                        <SelectItem value="Europe/Paris">Paris</SelectItem>
                        <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                        <SelectItem value="Asia/Shanghai">Shanghai</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Date Format</Label>
                    <Select
                      value={preferences.dateFormat}
                      onValueChange={(value) => updatePreferences({ dateFormat: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MM/dd/yyyy">MM/dd/yyyy</SelectItem>
                        <SelectItem value="dd/MM/yyyy">dd/MM/yyyy</SelectItem>
                        <SelectItem value="yyyy-MM-dd">yyyy-MM-dd</SelectItem>
                        <SelectItem value="dd MMM yyyy">dd MMM yyyy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Time Format</Label>
                    <Select
                      value={preferences.timeFormat}
                      onValueChange={(value) => updatePreferences({ timeFormat: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12h">12 Hour</SelectItem>
                        <SelectItem value="24h">24 Hour</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Dashboard Settings</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Default Dashboard</Label>
                    <Select
                      value={preferences.defaultDashboard}
                      onValueChange={(value) => updatePreferences({ defaultDashboard: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="executive">Executive</SelectItem>
                        <SelectItem value="operational">Operational</SelectItem>
                        <SelectItem value="financial">Financial</SelectItem>
                        <SelectItem value="procurement">Procurement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Refresh Interval (seconds)</Label>
                    <div className="px-3">
                      <Slider
                        value={[preferences.dashboardRefreshInterval / 1000]}
                        onValueChange={([value]) => updatePreferences({ dashboardRefreshInterval: value * 1000 })}
                        max={300}
                        min={10}
                        step={10}
                        className="w-full"
                      />
                      <div className="flex justify-between text-sm text-muted-foreground mt-1">
                        <span>10s</span>
                        <span>{preferences.dashboardRefreshInterval / 1000}s</span>
                        <span>300s</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="welcome-message">Show Welcome Message</Label>
                  <Switch
                    id="welcome-message"
                    checked={preferences.showWelcomeMessage}
                    onCheckedChange={(checked) => updatePreferences({ showWelcomeMessage: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="compact-mode">Compact Mode</Label>
                  <Switch
                    id="compact-mode"
                    checked={preferences.compactMode}
                    onCheckedChange={(checked) => updatePreferences({ compactMode: checked })}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Notification Preferences */}
            <TabsContent value="notifications" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Notification Settings
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="email-notifications">Email Notifications</Label>
                      <Switch
                        id="email-notifications"
                        checked={preferences.emailNotifications}
                        onCheckedChange={(checked) => updatePreferences({ emailNotifications: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="push-notifications">Push Notifications</Label>
                      <Switch
                        id="push-notifications"
                        checked={preferences.pushNotifications}
                        onCheckedChange={(checked) => updatePreferences({ pushNotifications: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="notification-sound">Notification Sound</Label>
                      <Switch
                        id="notification-sound"
                        checked={preferences.notificationSound}
                        onCheckedChange={(checked) => updatePreferences({ notificationSound: checked })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Notification Frequency</Label>
                      <Select
                        value={preferences.notificationFrequency}
                        onValueChange={(value) => updatePreferences({ notificationFrequency: value as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="immediate">Immediate</SelectItem>
                          <SelectItem value="hourly">Hourly Digest</SelectItem>
                          <SelectItem value="daily">Daily Digest</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Notification Types</h4>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="requisition-approval">Requisition Approvals</Label>
                        <Switch
                          id="requisition-approval"
                          checked={preferences.notificationTypes.requisitionApproval}
                          onCheckedChange={(checked) => 
                            updatePreferences({ 
                              notificationTypes: { 
                                ...preferences.notificationTypes, 
                                requisitionApproval: checked 
                              } 
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="order-updates">Order Updates</Label>
                        <Switch
                          id="order-updates"
                          checked={preferences.notificationTypes.orderUpdates}
                          onCheckedChange={(checked) => 
                            updatePreferences({ 
                              notificationTypes: { 
                                ...preferences.notificationTypes, 
                                orderUpdates: checked 
                              } 
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="budget-alerts">Budget Alerts</Label>
                        <Switch
                          id="budget-alerts"
                          checked={preferences.notificationTypes.budgetAlerts}
                          onCheckedChange={(checked) => 
                            updatePreferences({ 
                              notificationTypes: { 
                                ...preferences.notificationTypes, 
                                budgetAlerts: checked 
                              } 
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="system-maintenance">System Maintenance</Label>
                        <Switch
                          id="system-maintenance"
                          checked={preferences.notificationTypes.systemMaintenance}
                          onCheckedChange={(checked) => 
                            updatePreferences({ 
                              notificationTypes: { 
                                ...preferences.notificationTypes, 
                                systemMaintenance: checked 
                              } 
                            })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="security-alerts">Security Alerts</Label>
                        <Switch
                          id="security-alerts"
                          checked={preferences.notificationTypes.securityAlerts}
                          onCheckedChange={(checked) => 
                            updatePreferences({ 
                              notificationTypes: { 
                                ...preferences.notificationTypes, 
                                securityAlerts: checked 
                              } 
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Table Preferences */}
            <TabsContent value="tables" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Table className="h-4 w-4" />
                  Table Settings
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Default Page Size</Label>
                      <Select
                        value={preferences.defaultPageSize.toString()}
                        onValueChange={(value) => updatePreferences({ defaultPageSize: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10 rows</SelectItem>
                          <SelectItem value="25">25 rows</SelectItem>
                          <SelectItem value="50">50 rows</SelectItem>
                          <SelectItem value="100">100 rows</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-row-numbers">Show Row Numbers</Label>
                      <Switch
                        id="show-row-numbers"
                        checked={preferences.showRowNumbers}
                        onCheckedChange={(checked) => updatePreferences({ showRowNumbers: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="enable-column-resize">Enable Column Resize</Label>
                      <Switch
                        id="enable-column-resize"
                        checked={preferences.enableColumnResize}
                        onCheckedChange={(checked) => updatePreferences({ enableColumnResize: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="enable-column-reorder">Enable Column Reorder</Label>
                      <Switch
                        id="enable-column-reorder"
                        checked={preferences.enableColumnReorder}
                        onCheckedChange={(checked) => updatePreferences({ enableColumnReorder: checked })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Search Preferences */}
            <TabsContent value="search" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search Settings
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="save-search-history">Save Search History</Label>
                      <Switch
                        id="save-search-history"
                        checked={preferences.saveSearchHistory}
                        onCheckedChange={(checked) => updatePreferences({ saveSearchHistory: checked })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Max Search History</Label>
                      <Select
                        value={preferences.maxSearchHistory.toString()}
                        onValueChange={(value) => updatePreferences({ maxSearchHistory: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 searches</SelectItem>
                          <SelectItem value="10">10 searches</SelectItem>
                          <SelectItem value="20">20 searches</SelectItem>
                          <SelectItem value="50">50 searches</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Default Search Operator</Label>
                      <Select
                        value={preferences.defaultSearchOperator}
                        onValueChange={(value) => updatePreferences({ defaultSearchOperator: value as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contains">Contains</SelectItem>
                          <SelectItem value="equals">Equals</SelectItem>
                          <SelectItem value="startsWith">Starts With</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Accessibility Preferences */}
            <TabsContent value="accessibility" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Accessibility Settings
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="high-contrast">High Contrast Mode</Label>
                      <Switch
                        id="high-contrast"
                        checked={preferences.accessibility.highContrast}
                        onCheckedChange={(checked) => 
                          updatePreferences({ 
                            accessibility: { 
                              ...preferences.accessibility, 
                              highContrast: checked 
                            } 
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="large-text">Large Text</Label>
                      <Switch
                        id="large-text"
                        checked={preferences.accessibility.largeText}
                        onCheckedChange={(checked) => 
                          updatePreferences({ 
                            accessibility: { 
                              ...preferences.accessibility, 
                              largeText: checked 
                            } 
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="reduced-motion">Reduced Motion</Label>
                      <Switch
                        id="reduced-motion"
                        checked={preferences.accessibility.reducedMotion}
                        onCheckedChange={(checked) => 
                          updatePreferences({ 
                            accessibility: { 
                              ...preferences.accessibility, 
                              reducedMotion: checked 
                            } 
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="screen-reader-mode">Screen Reader Mode</Label>
                      <Switch
                        id="screen-reader-mode"
                        checked={preferences.accessibility.screenReaderMode}
                        onCheckedChange={(checked) => 
                          updatePreferences({ 
                            accessibility: { 
                              ...preferences.accessibility, 
                              screenReaderMode: checked 
                            } 
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="keyboard-navigation">Enhanced Keyboard Navigation</Label>
                      <Switch
                        id="keyboard-navigation"
                        checked={preferences.accessibility.keyboardNavigation}
                        onCheckedChange={(checked) => 
                          updatePreferences({ 
                            accessibility: { 
                              ...preferences.accessibility, 
                              keyboardNavigation: checked 
                            } 
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Color Blind Support</Label>
                      <Select
                        value={preferences.accessibility.colorBlindMode}
                        onValueChange={(value) => 
                          updatePreferences({ 
                            accessibility: { 
                              ...preferences.accessibility, 
                              colorBlindMode: value as any 
                            } 
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="protanopia">Protanopia</SelectItem>
                          <SelectItem value="deuteranopia">Deuteranopia</SelectItem>
                          <SelectItem value="tritanopia">Tritanopia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Maritime Preferences */}
            <TabsContent value="maritime" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Ship className="h-4 w-4" />
                  Maritime Settings
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Default Vessel</Label>
                      <Input
                        value={preferences.maritime.defaultVessel}
                        onChange={(e) => 
                          updatePreferences({ 
                            maritime: { 
                              ...preferences.maritime, 
                              defaultVessel: e.target.value 
                            } 
                          })
                        }
                        placeholder="Select default vessel"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Default Urgency Level</Label>
                      <Select
                        value={preferences.maritime.defaultUrgencyLevel}
                        onValueChange={(value) => 
                          updatePreferences({ 
                            maritime: { 
                              ...preferences.maritime, 
                              defaultUrgencyLevel: value as any 
                            } 
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ROUTINE">Routine</SelectItem>
                          <SelectItem value="URGENT">Urgent</SelectItem>
                          <SelectItem value="EMERGENCY">Emergency</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="show-vessel-position">Show Vessel Position</Label>
                      <Switch
                        id="show-vessel-position"
                        checked={preferences.maritime.showVesselPosition}
                        onCheckedChange={(checked) => 
                          updatePreferences({ 
                            maritime: { 
                              ...preferences.maritime, 
                              showVesselPosition: checked 
                            } 
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="enable-offline-mode">Enable Offline Mode</Label>
                      <Switch
                        id="enable-offline-mode"
                        checked={preferences.maritime.enableOfflineMode}
                        onCheckedChange={(checked) => 
                          updatePreferences({ 
                            maritime: { 
                              ...preferences.maritime, 
                              enableOfflineMode: checked 
                            } 
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Preferred Ports</Label>
                  <div className="flex flex-wrap gap-2">
                    {preferences.maritime.preferredPorts.map((port, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {port}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 hover:bg-transparent"
                          onClick={() => {
                            const newPorts = preferences.maritime.preferredPorts.filter((_, i) => i !== index);
                            updatePreferences({ 
                              maritime: { 
                                ...preferences.maritime, 
                                preferredPorts: newPorts 
                              } 
                            });
                          }}
                        >
                          ×
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Privacy Preferences */}
            <TabsContent value="privacy" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Privacy Settings
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="share-usage-data">Share Usage Data</Label>
                      <p className="text-sm text-muted-foreground">
                        Help improve FlowMarine by sharing anonymous usage data
                      </p>
                    </div>
                    <Switch
                      id="share-usage-data"
                      checked={preferences.privacy.shareUsageData}
                      onCheckedChange={(checked) => 
                        updatePreferences({ 
                          privacy: { 
                            ...preferences.privacy, 
                            shareUsageData: checked 
                          } 
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="allow-cookies">Allow Cookies</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable cookies for better user experience
                      </p>
                    </div>
                    <Switch
                      id="allow-cookies"
                      checked={preferences.privacy.allowCookies}
                      onCheckedChange={(checked) => 
                        updatePreferences({ 
                          privacy: { 
                            ...preferences.privacy, 
                            allowCookies: checked 
                          } 
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Data Retention</Label>
                    <Select
                      value={preferences.privacy.dataRetention}
                      onValueChange={(value) => 
                        updatePreferences({ 
                          privacy: { 
                            ...preferences.privacy, 
                            dataRetention: value as any 
                          } 
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30days">30 Days</SelectItem>
                        <SelectItem value="90days">90 Days</SelectItem>
                        <SelectItem value="1year">1 Year</SelectItem>
                        <SelectItem value="indefinite">Indefinite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Advanced Preferences */}
            <TabsContent value="advanced" className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Advanced Settings</h3>
                
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-4">
                    These settings are for advanced users. Changing these may affect system performance.
                  </p>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Cache Duration (minutes)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="1440"
                        defaultValue="60"
                        className="w-32"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>API Timeout (seconds)</Label>
                      <Input
                        type="number"
                        min="5"
                        max="300"
                        defaultValue="30"
                        className="w-32"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="debug-mode">Debug Mode</Label>
                      <Switch id="debug-mode" />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};