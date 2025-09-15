import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Save, Send, FileText, Calendar, Building, Ship, AlertCircle } from 'lucide-react';
import { Button, Card, Badge } from '../ui';
import { useAppDispatch } from '../../store/hooks';
import { addRequisition } from '../../store/slices/requisitionSlice';
import { CreateRequisitionData, Requisition } from '../../types/requisition';
import { mockVessels, mockDepartments, mockItemCategories } from '../../data/mockRequisitions';

const requisitionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().optional(),
  vesselId: z.string().min(1, 'Vessel is required'),
  departmentId: z.string().min(1, 'Department is required'),
  requiredDate: z.string().min(1, 'Required date is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  items: z.array(z.object({
    itemCode: z.string().min(1, 'Item code is required'),
    description: z.string().min(1, 'Description is required'),
    quantity: z.number().min(1, 'Quantity must be at least 1'),
    unit: z.string().min(1, 'Unit is required'),
    estimatedPrice: z.number().min(0, 'Price must be positive'),
    category: z.string().min(1, 'Category is required'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    specifications: z.string().optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
  })).min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof requisitionSchema>;

interface CreateRequisitionFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const priorityColors = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

const priorityIcons = {
  low: '🟢',
  medium: '🟡',
  high: '🟠',
  urgent: '🔴',
};

export const CreateRequisitionForm: React.FC<CreateRequisitionFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const dispatch = useAppDispatch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitType, setSubmitType] = useState<'draft' | 'submit'>('draft');

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(requisitionSchema),
    defaultValues: {
      title: '',
      description: '',
      vesselId: '',
      departmentId: '',
      requiredDate: '',
      priority: 'medium',
      items: [
        {
          itemCode: '',
          description: '',
          quantity: 1,
          unit: '',
          estimatedPrice: 0,
          category: '',
          priority: 'medium',
          specifications: '',
          brand: '',
          model: '',
        },
      ],
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const watchedItems = watch('items');
  const totalEstimatedValue = watchedItems.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.estimatedPrice || 0),
    0
  );

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const newRequisition: Requisition = {
        id: `req-${Date.now()}`,
        requisitionNumber: `REQ-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
        title: data.title,
        description: data.description,
        vesselId: data.vesselId,
        vesselName: mockVessels.find(v => v.id === data.vesselId)?.name || '',
        departmentId: data.departmentId,
        departmentName: mockDepartments.find(d => d.id === data.departmentId)?.name || '',
        requestedBy: 'current-user',
        requestedByName: 'Current User',
        requestedDate: new Date().toISOString(),
        requiredDate: new Date(data.requiredDate).toISOString(),
        status: submitType === 'draft' ? 'draft' : 'submitted',
        priority: data.priority,
        items: data.items.map((item, index) => ({
          id: `item-${Date.now()}-${index}`,
          ...item,
        })),
        totalEstimatedValue,
        approvalHistory: [],
        attachments: [],
        notes: data.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      dispatch(addRequisition(newRequisition));
      onSuccess?.();
    } catch (error) {
      console.error('Error creating requisition:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addItem = () => {
    append({
      itemCode: '',
      description: '',
      quantity: 1,
      unit: '',
      estimatedPrice: 0,
      category: '',
      priority: 'medium',
      specifications: '',
      brand: '',
      model: '',
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create New Requisition</h1>
          <p className="text-gray-600 mt-1">Submit a new procurement request for your vessel</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-lg px-3 py-1">
            Total: ${totalEstimatedValue.toLocaleString()}
          </Badge>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <FileText className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold">Basic Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Requisition Title *
              </label>
              <input
                {...register('title')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter requisition title"
              />
              {errors.title && (
                <p className="text-red-600 text-sm mt-1">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority *
              </label>
              <select
                {...register('priority')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(priorityColors).map(([priority, _]) => (
                  <option key={priority} value={priority}>
                    {priorityIcons[priority as keyof typeof priorityIcons]} {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Ship className="inline h-4 w-4 mr-1" />
                Vessel *
              </label>
              <select
                {...register('vesselId')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select vessel</option>
                {mockVessels.map((vessel) => (
                  <option key={vessel.id} value={vessel.id}>
                    {vessel.name} ({vessel.type})
                  </option>
                ))}
              </select>
              {errors.vesselId && (
                <p className="text-red-600 text-sm mt-1">{errors.vesselId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building className="inline h-4 w-4 mr-1" />
                Department *
              </label>
              <select
                {...register('departmentId')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select department</option>
                {mockDepartments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              {errors.departmentId && (
                <p className="text-red-600 text-sm mt-1">{errors.departmentId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline h-4 w-4 mr-1" />
                Required Date *
              </label>
              <input
                type="date"
                {...register('requiredDate')}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.requiredDate && (
                <p className="text-red-600 text-sm mt-1">{errors.requiredDate.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                {...register('description')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Provide additional details about this requisition"
              />
            </div>
          </div>
        </Card>

        {/* Items Section */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Requisition Items</h2>
            <Button
              type="button"
              onClick={addItem}
              className="flex items-center space-x-2"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              <span>Add Item</span>
            </Button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900">Item #{index + 1}</h3>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      onClick={() => remove(index)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Item Code *
                    </label>
                    <input
                      {...register(`items.${index}.itemCode`)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., ENG-001"
                    />
                    {errors.items?.[index]?.itemCode && (
                      <p className="text-red-600 text-xs mt-1">
                        {errors.items[index]?.itemCode?.message}
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description *
                    </label>
                    <input
                      {...register(`items.${index}.description`)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Item description"
                    />
                    {errors.items?.[index]?.description && (
                      <p className="text-red-600 text-xs mt-1">
                        {errors.items[index]?.description?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category *
                    </label>
                    <select
                      {...register(`items.${index}.category`)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select category</option>
                      {mockItemCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit *
                    </label>
                    <input
                      {...register(`items.${index}.unit`)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Pieces, Liters"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Est. Price ($) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      {...register(`items.${index}.estimatedPrice`, { valueAsNumber: true })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <select
                      {...register(`items.${index}.priority`)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Object.entries(priorityColors).map(([priority, _]) => (
                        <option key={priority} value={priority}>
                          {priority.charAt(0).toUpperCase() + priority.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Brand
                    </label>
                    <input
                      {...register(`items.${index}.brand`)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Model
                    </label>
                    <input
                      {...register(`items.${index}.model`)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Optional"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Specifications
                    </label>
                    <input
                      {...register(`items.${index}.specifications`)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Technical specifications (optional)"
                    />
                  </div>
                </div>

                <div className="mt-3 p-2 bg-blue-50 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Item Total:</strong> $
                    {((watchedItems[index]?.quantity || 0) * (watchedItems[index]?.estimatedPrice || 0)).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {errors.items && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                <p className="text-red-600 text-sm">Please fix the errors in the items above</p>
              </div>
            </div>
          )}
        </Card>

        {/* Notes Section */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Additional Notes</h2>
          <textarea
            {...register('notes')}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Add any additional notes or special instructions for this requisition..."
          />
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <div className="flex items-center space-x-3">
            <Button
              type="submit"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setSubmitType('draft')}
              className="flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{isSubmitting && submitType === 'draft' ? 'Saving...' : 'Save as Draft'}</span>
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting || !isValid}
              onClick={() => setSubmitType('submit')}
              className="flex items-center space-x-2"
            >
              <Send className="h-4 w-4" />
              <span>{isSubmitting && submitType === 'submit' ? 'Submitting...' : 'Submit for Approval'}</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};