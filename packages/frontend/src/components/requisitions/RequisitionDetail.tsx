import React from 'react';
import { 
  ArrowLeft, 
  Edit, 
  Download, 
  Share, 
  CheckCircle, 
  XCircle, 
  Clock,
  FileText,
  Ship,
  Building,
  User,
  Calendar,
  DollarSign,
  Package,
  MessageSquare,
  Paperclip,
  AlertCircle
} from 'lucide-react';
import { Button, Card, Badge } from '../ui';
import { Requisition } from '../../types/requisition';

interface RequisitionDetailProps {
  requisition: Requisition;
  onBack?: () => void;
  onEdit?: () => void;
}

const statusConfig = {
  draft: { 
    color: 'bg-gray-100 text-gray-800', 
    icon: FileText, 
    label: 'Draft' 
  },
  submitted: { 
    color: 'bg-blue-100 text-blue-800', 
    icon: Clock, 
    label: 'Submitted' 
  },
  approved: { 
    color: 'bg-green-100 text-green-800', 
    icon: CheckCircle, 
    label: 'Approved' 
  },
  rejected: { 
    color: 'bg-red-100 text-red-800', 
    icon: XCircle, 
    label: 'Rejected' 
  },
  in_procurement: { 
    color: 'bg-yellow-100 text-yellow-800', 
    icon: Clock, 
    label: 'In Procurement' 
  },
  completed: { 
    color: 'bg-green-100 text-green-800', 
    icon: CheckCircle, 
    label: 'Completed' 
  },
};

const priorityConfig = {
  low: { color: 'bg-green-100 text-green-800', emoji: '🟢' },
  medium: { color: 'bg-yellow-100 text-yellow-800', emoji: '🟡' },
  high: { color: 'bg-orange-100 text-orange-800', emoji: '🟠' },
  urgent: { color: 'bg-red-100 text-red-800', emoji: '🔴' },
};

const approvalStatusConfig = {
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
};

export const RequisitionDetail: React.FC<RequisitionDetailProps> = ({
  requisition,
  onBack,
  onEdit,
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusIcon = (status: Requisition['status']) => {
    const StatusIcon = statusConfig[status].icon;
    return <StatusIcon className="h-5 w-5" />;
  };

  const getApprovalIcon = (status: 'pending' | 'approved' | 'rejected') => {
    const ApprovalIcon = approvalStatusConfig[status].icon;
    return <ApprovalIcon className="h-4 w-4" />;
  };

  const canEdit = requisition.status === 'draft' || requisition.status === 'rejected';

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={onBack} className="flex items-center space-x-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{requisition.title}</h1>
            <p className="text-gray-600 mt-1">{requisition.requisitionNumber}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Badge className={statusConfig[requisition.status].color}>
            {getStatusIcon(requisition.status)}
            <span className="ml-2">{statusConfig[requisition.status].label}</span>
          </Badge>
          <Badge className={priorityConfig[requisition.priority].color}>
            {priorityConfig[requisition.priority].emoji} {requisition.priority.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end space-x-3">
        <Button variant="outline" className="flex items-center space-x-2">
          <Share className="h-4 w-4" />
          <span>Share</span>
        </Button>
        <Button variant="outline" className="flex items-center space-x-2">
          <Download className="h-4 w-4" />
          <span>Export</span>
        </Button>
        {canEdit && (
          <Button onClick={onEdit} className="flex items-center space-x-2">
            <Edit className="h-4 w-4" />
            <span>Edit</span>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-blue-600" />
              Basic Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Ship className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Vessel</p>
                    <p className="text-gray-900">{requisition.vesselName}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Building className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Department</p>
                    <p className="text-gray-900">{requisition.departmentName}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Requested By</p>
                    <p className="text-gray-900">{requisition.requestedByName}</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Requested Date</p>
                    <p className="text-gray-900">{formatDateShort(requisition.requestedDate)}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Required Date</p>
                    <p className="text-gray-900">{formatDateShort(requisition.requiredDate)}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Estimated Value</p>
                    <p className="text-gray-900 text-lg font-semibold">
                      ${requisition.totalEstimatedValue.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {requisition.description && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-500 mb-2">Description</p>
                <p className="text-gray-900">{requisition.description}</p>
              </div>
            )}
          </Card>

          {/* Items */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <Package className="h-5 w-5 mr-2 text-blue-600" />
              Requisition Items ({requisition.items.length})
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Item Code</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Description</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Qty</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Unit</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Price</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Total</th>
                    <th className="text-left py-3 px-2 font-medium text-gray-500">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {requisition.items.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium text-gray-900">{item.itemCode}</p>
                          <p className="text-sm text-gray-500">{item.category}</p>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div>
                          <p className="text-gray-900">{item.description}</p>
                          {item.brand && (
                            <p className="text-sm text-gray-500">
                              {item.brand} {item.model && `- ${item.model}`}
                            </p>
                          )}
                          {item.specifications && (
                            <p className="text-xs text-gray-400 mt-1">{item.specifications}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-gray-900">{item.quantity}</td>
                      <td className="py-3 px-2 text-gray-900">{item.unit}</td>
                      <td className="py-3 px-2 text-gray-900">${item.estimatedPrice.toFixed(2)}</td>
                      <td className="py-3 px-2 text-gray-900 font-medium">
                        ${(item.quantity * item.estimatedPrice).toFixed(2)}
                      </td>
                      <td className="py-3 px-2">
                        <Badge className={priorityConfig[item.priority].color} size="sm">
                          {item.priority}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300">
                    <td colSpan={5} className="py-3 px-2 text-right font-semibold text-gray-900">
                      Total Estimated Value:
                    </td>
                    <td className="py-3 px-2 font-bold text-lg text-gray-900">
                      ${requisition.totalEstimatedValue.toLocaleString()}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Notes */}
          {requisition.notes && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <MessageSquare className="h-5 w-5 mr-2 text-blue-600" />
                Additional Notes
              </h2>
              <p className="text-gray-900 whitespace-pre-wrap">{requisition.notes}</p>
            </Card>
          )}

          {/* Attachments */}
          {requisition.attachments.length > 0 && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Paperclip className="h-5 w-5 mr-2 text-blue-600" />
                Attachments ({requisition.attachments.length})
              </h2>
              <div className="space-y-3">
                {requisition.attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{attachment.fileName}</p>
                        <p className="text-sm text-gray-500">
                          {(attachment.fileSize / 1024).toFixed(1)} KB • 
                          Uploaded by {attachment.uploadedBy} • 
                          {formatDateShort(attachment.uploadedAt)}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Timeline */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Status Timeline</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Created</p>
                  <p className="text-sm text-gray-500">{formatDate(requisition.createdAt)}</p>
                </div>
              </div>
              
              {requisition.status !== 'draft' && (
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Clock className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Submitted</p>
                    <p className="text-sm text-gray-500">{formatDate(requisition.updatedAt)}</p>
                  </div>
                </div>
              )}
              
              {(requisition.status === 'approved' || requisition.status === 'in_procurement' || requisition.status === 'completed') && (
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Approved</p>
                    <p className="text-sm text-gray-500">Approval completed</p>
                  </div>
                </div>
              )}
              
              {requisition.status === 'rejected' && (
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <XCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Rejected</p>
                    <p className="text-sm text-gray-500">Requires revision</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Approval History */}
          {requisition.approvalHistory.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Approval History</h3>
              <div className="space-y-4">
                {requisition.approvalHistory.map((approval) => (
                  <div key={approval.id} className="border-l-4 border-gray-200 pl-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-900">{approval.stepName}</p>
                      <Badge className={approvalStatusConfig[approval.status].color} size="sm">
                        {getApprovalIcon(approval.status)}
                        <span className="ml-1">{approval.status}</span>
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      {approval.approverName} ({approval.approverRole})
                    </p>
                    {approval.comments && (
                      <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                        "{approval.comments}"
                      </p>
                    )}
                    {approval.timestamp && (
                      <p className="text-xs text-gray-500 mt-2">
                        {formatDate(approval.timestamp)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Quick Stats */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Items:</span>
                <span className="font-medium">{requisition.items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estimated Value:</span>
                <span className="font-medium">${requisition.totalEstimatedValue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg. Item Value:</span>
                <span className="font-medium">
                  ${(requisition.totalEstimatedValue / requisition.items.length).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Days to Required:</span>
                <span className="font-medium">
                  {Math.ceil((new Date(requisition.requiredDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                </span>
              </div>
            </div>
          </Card>

          {/* Actions */}
          {requisition.status === 'rejected' && (
            <Card className="p-6 border-red-200 bg-red-50">
              <div className="flex items-center space-x-2 mb-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <h3 className="text-lg font-semibold text-red-900">Action Required</h3>
              </div>
              <p className="text-red-800 text-sm mb-4">
                This requisition has been rejected and requires revision before resubmission.
              </p>
              <Button onClick={onEdit} className="w-full bg-red-600 hover:bg-red-700">
                <Edit className="h-4 w-4 mr-2" />
                Edit & Resubmit
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};