import React, { useState } from 'react';
import { RequisitionsList } from '../components/requisitions/RequisitionsList';
import { CreateRequisitionForm } from '../components/requisitions/CreateRequisitionForm';
import { RequisitionDetail } from '../components/requisitions/RequisitionDetail';
import { Requisition } from '../types/requisition';

type ViewMode = 'list' | 'create' | 'detail' | 'edit';

export const RequisitionsPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);

  const handleCreateNew = () => {
    setViewMode('create');
    setSelectedRequisition(null);
  };

  const handleViewRequisition = (requisition: Requisition) => {
    setSelectedRequisition(requisition);
    setViewMode('detail');
  };

  const handleEditRequisition = (requisition: Requisition) => {
    setSelectedRequisition(requisition);
    setViewMode('edit');
  };

  const handleBack = () => {
    setViewMode('list');
    setSelectedRequisition(null);
  };

  const handleSuccess = () => {
    setViewMode('list');
    setSelectedRequisition(null);
  };

  const renderContent = () => {
    switch (viewMode) {
      case 'create':
        return (
          <CreateRequisitionForm
            onSuccess={handleSuccess}
            onCancel={handleBack}
          />
        );
      
      case 'detail':
        return selectedRequisition ? (
          <RequisitionDetail
            requisition={selectedRequisition}
            onBack={handleBack}
            onEdit={() => handleEditRequisition(selectedRequisition)}
          />
        ) : null;
      
      case 'edit':
        return selectedRequisition ? (
          <CreateRequisitionForm
            onSuccess={handleSuccess}
            onCancel={handleBack}
          />
        ) : null;
      
      case 'list':
      default:
        return (
          <RequisitionsList
            onCreateNew={handleCreateNew}
            onViewRequisition={handleViewRequisition}
            onEditRequisition={handleEditRequisition}
          />
        );
    }
  };

  return <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">{renderContent()}</div>;
};