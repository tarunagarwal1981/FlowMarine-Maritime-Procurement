import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import RequisitionListScreen from '../../screens/requisitions/RequisitionListScreen';
import RequisitionDetailScreen from '../../screens/requisitions/RequisitionDetailScreen';
import RequisitionCreateScreen from '../../screens/requisitions/RequisitionCreateScreen';
import ApprovalWorkflowScreen from '../../screens/requisitions/ApprovalWorkflowScreen';

export type RequisitionStackParamList = {
  RequisitionList: undefined;
  RequisitionDetail: {
    requisitionId: string;
  };
  RequisitionCreate: undefined;
  RequisitionEdit: {
    requisitionId: string;
  };
  ApprovalWorkflow: {
    requisitionId: string;
  };
  BarcodeScanner: {
    onScan: (data: string) => void;
  };
};

const Stack = createStackNavigator<RequisitionStackParamList>();

const RequisitionStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="RequisitionList"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1e40af',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}>
      <Stack.Screen
        name="RequisitionList"
        component={RequisitionListScreen}
        options={{
          title: 'Requisitions',
        }}
      />
      <Stack.Screen
        name="RequisitionDetail"
        component={RequisitionDetailScreen}
        options={{
          title: 'Requisition Details',
        }}
      />
      <Stack.Screen
        name="RequisitionCreate"
        component={RequisitionCreateScreen}
        options={{
          title: 'Create Requisition',
        }}
      />
      <Stack.Screen
        name="RequisitionEdit"
        component={RequisitionCreateScreen}
        options={{
          title: 'Edit Requisition',
        }}
      />
      <Stack.Screen
        name="ApprovalWorkflow"
        component={ApprovalWorkflowScreen}
        options={{
          title: 'Approval Workflow',
        }}
      />
    </Stack.Navigator>
  );
};

export default RequisitionStackNavigator;