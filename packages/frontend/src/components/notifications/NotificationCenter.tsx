import React, { useState } from 'react';
import { useNotifications, Notification, NotificationRule } from './NotificationProvider';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ScrollArea } from '../ui/scroll-area';
import { 
  Bell, 
  BellOff, 
  Check, 
  CheckCheck, 
  Trash2, 
  Filter, 
  Settings, 
  Plus,
  Play,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const NotificationCenter: React.FC = () => {
  const {
    notifications,
    unreadCount,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    getNotificationsByCategory,
    getNotificationsByPriority,
    requestPermission,
    isPermissionGranted,
    rules,
    addRule,
    updateRule,
    removeRule,
    testRule
  } = useNotifications();

  const [filter, setFilter] = useState<'all' | 'unread' | 'category' | 'priority'>('all');
  const [filterValue, setFilterValue] = useState('');
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [newRule, setNewRule] = useState<Partial<NotificationRule>>({
    name: '',
    conditions: {},
    actions: {},
    enabled: true
  });

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
      case 'urgent':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    switch (filter) {
      case 'unread':
        return !notification.read;
      case 'category':
        return filterValue ? notification.category === filterValue : true;
      case 'priority':
        return filterValue ? notification.priority === filterValue : true;
      default:
        return true;
    }
  });

  const handleAddRule = () => {
    if (newRule.name) {
      addRule(newRule as Omit<NotificationRule, 'id'>);
      setNewRule({
        name: '',
        conditions: {},
        actions: {},
        enabled: true
      });
      setShowRuleDialog(false);
    }
  };

  const handleNotificationAction = (notification: Notification, actionId: string) => {
    const action = notification.actions?.find(a => a.id === actionId);
    if (action) {
      action.action();
      markAsRead(notification.id);
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Center
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {!isPermissionGranted && (
              <Button variant="outline" size="sm" onClick={requestPermission}>
                <Bell className="h-4 w-4 mr-2" />
                Enable Notifications
              </Button>
            )}
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Filter Type</Label>
                    <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Notifications</SelectItem>
                        <SelectItem value="unread">Unread Only</SelectItem>
                        <SelectItem value="category">By Category</SelectItem>
                        <SelectItem value="priority">By Priority</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {(filter === 'category' || filter === 'priority') && (
                    <div className="space-y-2">
                      <Label>Filter Value</Label>
                      {filter === 'category' ? (
                        <Select value={filterValue} onValueChange={setFilterValue}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="requisitionApproval">Requisition Approval</SelectItem>
                            <SelectItem value="orderUpdates">Order Updates</SelectItem>
                            <SelectItem value="budgetAlerts">Budget Alerts</SelectItem>
                            <SelectItem value="systemMaintenance">System Maintenance</SelectItem>
                            <SelectItem value="securityAlerts">Security Alerts</SelectItem>
                            <SelectItem value="general">General</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select value={filterValue} onValueChange={setFilterValue}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
            
            <Button variant="outline" size="sm" onClick={clearAll}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="notifications" className="w-full">
          <TabsList>
            <TabsTrigger value="notifications">
              Notifications
              {unreadCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
          </TabsList>

          <TabsContent value="notifications">
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {filteredNotifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BellOff className="h-8 w-8 mx-auto mb-2" />
                    <p>No notifications to display</p>
                  </div>
                ) : (
                  filteredNotifications.map(notification => (
                    <Card 
                      key={notification.id} 
                      className={`transition-all ${
                        notification.read ? 'opacity-60' : 'border-l-4 border-l-blue-500'
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="flex items-center gap-2">
                              {getNotificationIcon(notification.type)}
                              <div 
                                className={`w-2 h-2 rounded-full ${getPriorityColor(notification.priority)}`}
                                title={`Priority: ${notification.priority}`}
                              />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-sm">{notification.title}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {notification.category}
                                </Badge>
                              </div>
                              
                              <p className="text-sm text-muted-foreground mb-2">
                                {notification.message}
                              </p>
                              
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                                </span>
                                
                                {notification.expiresAt && (
                                  <span>
                                    Expires {formatDistanceToNow(notification.expiresAt, { addSuffix: true })}
                                  </span>
                                )}
                              </div>
                              
                              {notification.actions && notification.actions.length > 0 && (
                                <div className="flex gap-2 mt-3">
                                  {notification.actions.map(action => (
                                    <Button
                                      key={action.id}
                                      variant={action.variant || 'outline'}
                                      size="sm"
                                      onClick={() => handleNotificationAction(notification, action.id)}
                                    >
                                      {action.label}
                                    </Button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 ml-2">
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsRead(notification.id)}
                                title="Mark as read"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeNotification(notification.id)}
                              title="Remove notification"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="rules">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Notification Rules</h3>
                <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Rule
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create Notification Rule</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Rule Name</Label>
                        <Input
                          value={newRule.name || ''}
                          onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Enter rule name"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-4">
                          <h4 className="font-medium">Conditions</h4>
                          
                          <div className="space-y-2">
                            <Label>Categories</Label>
                            <Select
                              onValueChange={(value) => 
                                setNewRule(prev => ({
                                  ...prev,
                                  conditions: {
                                    ...prev.conditions,
                                    category: [value]
                                  }
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select categories" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="requisitionApproval">Requisition Approval</SelectItem>
                                <SelectItem value="orderUpdates">Order Updates</SelectItem>
                                <SelectItem value="budgetAlerts">Budget Alerts</SelectItem>
                                <SelectItem value="systemMaintenance">System Maintenance</SelectItem>
                                <SelectItem value="securityAlerts">Security Alerts</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Priority</Label>
                            <Select
                              onValueChange={(value) => 
                                setNewRule(prev => ({
                                  ...prev,
                                  conditions: {
                                    ...prev.conditions,
                                    priority: [value]
                                  }
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="critical">Critical</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-medium">Actions</h4>
                          
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label>Play Sound</Label>
                              <Switch
                                checked={newRule.actions?.sound || false}
                                onCheckedChange={(checked) =>
                                  setNewRule(prev => ({
                                    ...prev,
                                    actions: { ...prev.actions, sound: checked }
                                  }))
                                }
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <Label>Vibration</Label>
                              <Switch
                                checked={newRule.actions?.vibration || false}
                                onCheckedChange={(checked) =>
                                  setNewRule(prev => ({
                                    ...prev,
                                    actions: { ...prev.actions, vibration: checked }
                                  }))
                                }
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <Label>Desktop Notification</Label>
                              <Switch
                                checked={newRule.actions?.desktop || false}
                                onCheckedChange={(checked) =>
                                  setNewRule(prev => ({
                                    ...prev,
                                    actions: { ...prev.actions, desktop: checked }
                                  }))
                                }
                              />
                            </div>

                            <div className="flex items-center justify-between">
                              <Label>Email</Label>
                              <Switch
                                checked={newRule.actions?.email || false}
                                onCheckedChange={(checked) =>
                                  setNewRule(prev => ({
                                    ...prev,
                                    actions: { ...prev.actions, email: checked }
                                  }))
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowRuleDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddRule}>
                          Create Rule
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-2">
                {rules.map(rule => (
                  <Card key={rule.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(checked) => updateRule(rule.id, { enabled: checked })}
                          />
                          <div>
                            <h4 className="font-medium">{rule.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {rule.conditions.category?.join(', ') || 'All categories'} • 
                              {rule.conditions.priority?.join(', ') || 'All priorities'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => testRule(rule)}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Test
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeRule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};