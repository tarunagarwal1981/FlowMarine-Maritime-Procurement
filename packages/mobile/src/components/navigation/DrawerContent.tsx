import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import {useSelector, useDispatch} from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {RootState} from '../../store/index';
import {logout} from '../../store/slices/authSlice';

const DrawerContent: React.FC<DrawerContentComponentProps> = (props) => {
  const dispatch = useDispatch();
  const {user} = useSelector((state: RootState) => state.auth);
  const {isOnline, pendingSync} = useSelector((state: RootState) => state.offline);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            dispatch(logout());
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      label: 'Dashboard',
      icon: 'dashboard',
      onPress: () => props.navigation.navigate('MainTabs'),
    },
    {
      label: 'Profile',
      icon: 'person',
      onPress: () => props.navigation.navigate('Profile'),
    },
    {
      label: 'Settings',
      icon: 'settings',
      onPress: () => props.navigation.navigate('Settings'),
    },
    {
      label: 'Help & Support',
      icon: 'help',
      onPress: () => props.navigation.navigate('Help'),
    },
    {
      label: 'About',
      icon: 'info',
      onPress: () => props.navigation.navigate('About'),
    },
  ];

  return (
    <View style={styles.container}>
      <DrawerContentScrollView {...props} contentContainerStyle={styles.scrollContent}>
        {/* User Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Icon name="account-circle" size={60} color="#1e40af" />
          </View>
          
          <View style={styles.userInfo}>
            <Text style={styles.userName}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <Text style={styles.userRole}>{user?.role}</Text>
          </View>

          {/* Connection Status */}
          <View style={styles.statusContainer}>
            <View style={[styles.statusIndicator, {backgroundColor: isOnline ? '#10b981' : '#ef4444'}]} />
            <Text style={styles.statusText}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            {pendingSync.length > 0 && (
              <View style={styles.syncBadge}>
                <Text style={styles.syncBadgeText}>{pendingSync.length}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Vessel Information */}
        {user?.vessels && user.vessels.length > 0 && (
          <View style={styles.vesselSection}>
            <Text style={styles.sectionTitle}>My Vessels</Text>
            {user.vessels.map((vessel) => (
              <View key={vessel.id} style={styles.vesselItem}>
                <Icon name="directions-boat" size={20} color="#64748b" />
                <View style={styles.vesselInfo}>
                  <Text style={styles.vesselName}>{vessel.name}</Text>
                  <Text style={styles.vesselImo}>IMO: {vessel.imoNumber}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}>
              <Icon name={item.icon} size={24} color="#64748b" />
              <Text style={styles.menuItemText}>{item.label}</Text>
              <Icon name="chevron-right" size={20} color="#94a3b8" />
            </TouchableOpacity>
          ))}
        </View>
      </DrawerContentScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Icon name="logout" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
        
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  profileSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 2,
  },
  userRole: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  syncBadge: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  syncBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  vesselSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  vesselItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  vesselInfo: {
    marginLeft: 12,
  },
  vesselName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  vesselImo: {
    fontSize: 12,
    color: '#64748b',
  },
  menuSection: {
    flex: 1,
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    marginLeft: 16,
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 12,
  },
  logoutText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '500',
    marginLeft: 8,
  },
  versionText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
});

export default DrawerContent;