import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Download,
  GitCompare,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Calendar,
  Building,
  FileText,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { Card, Badge, Button } from '../components/ui';

export const QuotesPage: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuotes, setSelectedQuotes] = useState<string[]>([]);

  const quotes = [
    {
      id: 'QUO-2024-001',
      title: 'Engine Room Maintenance Supplies',
      requisitionId: 'REQ-2024-001',
      vendor: 'Maritime Supply Co.',
      status: 'pending',
      totalAmount: 15750.00,
      validUntil: '2024-02-15',
      submittedDate: '2024-01-20',
      responseTime: '2 days',
      itemCount: 12,
      paymentTerms: 'Net 30',
      deliveryTime: '7-10 days',
      currency: 'USD',
      discount: 5.5,
      notes: 'Bulk discount applied for engine oil',
      vendor_rating: 4.8
    },
    {
      id: 'QUO-2024-002',
      title: 'Safety Equipment Upgrade',
      requisitionId: 'REQ-2024-002',
      vendor: 'Ocean Safety Ltd.',
      status: 'approved',
      totalAmount: 8950.00,
      validUntil: '2024-02-10',
      submittedDate: '2024-01-18',
      responseTime: '1 day',
      itemCount: 8,
      paymentTerms: 'Net 15',
      deliveryTime: '5-7 days',
      currency: 'USD',
      discount: 2.0,
      notes: 'Express delivery available',
      vendor_rating: 4.9
    },
    {
      id: 'QUO-2024-003',
      title: 'Navigation System Components',
      requisitionId: 'REQ-2024-003',
      vendor: 'Nautical Electronics',
      status: 'rejected',
      totalAmount: 25000.00,
      validUntil: '2024-02-20',
      submittedDate: '2024-01-22',
      responseTime: '3 days',
      itemCount: 3,
      paymentTerms: 'Net 45',
      deliveryTime: '14-21 days',
      currency: 'USD',
      discount: 0,
      notes: 'Price too high compared to alternatives',
      vendor_rating: 4.2
    },
    {
      id: 'QUO-2024-004',
      title: 'Deck Equipment Replacement',
      requisitionId: 'REQ-2024-004',
      vendor: 'Marine Equipment Pro',
      status: 'under_review',
      totalAmount: 12500.00,
      validUntil: '2024-02-25',
      submittedDate: '2024-01-25',
      responseTime: '4 days',
      itemCount: 15,
      paymentTerms: 'Net 30',
      deliveryTime: '10-14 days',
      currency: 'USD',
      discount: 7.5,
      notes: 'Technical review in progress',
      vendor_rating: 4.6
    },
    {
      id: 'QUO-2024-005',
      title: 'Galley Provisions Monthly',
      requisitionId: 'REQ-2024-005',
      vendor: 'Ship Catering Services',
      status: 'expired',
      totalAmount: 4200.00,
      validUntil: '2024-01-30',
      submittedDate: '2024-01-15',
      responseTime: '1 day',
      itemCount: 25,
      paymentTerms: 'Net 7',
      deliveryTime: '2-3 days',
      currency: 'USD',
      discount: 3.0,
      notes: 'Quote expired, new quote requested',
      vendor_rating: 4.4
    }
  ];

  const statusConfig = {
    pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending Review' },
    approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Approved' },
    rejected: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejected' },
    under_review: { color: 'bg-blue-100 text-blue-800', icon: FileText, label: 'Under Review' },
    expired: { color: 'bg-gray-100 text-gray-800', icon: XCircle, label: 'Expired' }
  };

  const tabs = [
    { id: 'all', label: 'All Quotes', count: quotes.length },
    { id: 'pending', label: 'Pending', count: quotes.filter(q => q.status === 'pending').length },
    { id: 'approved', label: 'Approved', count: quotes.filter(q => q.status === 'approved').length },
    { id: 'under_review', label: 'Under Review', count: quotes.filter(q => q.status === 'under_review').length }
  ];

  const filteredQuotes = quotes.filter(quote => {
    const matchesTab = selectedTab === 'all' || quote.status === selectedTab;
    const matchesSearch = quote.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.vendor.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const totalValue = filteredQuotes.reduce((sum, quote) => sum + quote.totalAmount, 0);
  const avgResponseTime = filteredQuotes.reduce((sum, quote) => sum + parseInt(quote.responseTime), 0) / filteredQuotes.length;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isExpiringSoon = (validUntil: string) => {
    const expiryDate = new Date(validUntil);
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays > 0;
  };

  const handleQuoteSelection = (quoteId: string) => {
    setSelectedQuotes(prev => 
      prev.includes(quoteId) 
        ? prev.filter(id => id !== quoteId)
        : [...prev, quoteId]
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-800">Quotes</h1>
          <p className="text-slate-600 mt-2">
            Manage vendor quotes and procurement proposals
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button className="bg-white/80 backdrop-blur-sm border border-slate-200/60 text-slate-700 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200 flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export</span>
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all duration-200 flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Request Quote</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Quote Value</p>
              <p className="text-2xl font-bold text-gray-900">${totalValue.toLocaleString()}</p>
              <div className="flex items-center mt-1">
                <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                <span className="text-sm text-green-600">+12.5%</span>
              </div>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Quotes</p>
              <p className="text-2xl font-bold text-gray-900">{filteredQuotes.length}</p>
              <div className="flex items-center mt-1">
                <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                <span className="text-sm text-green-600">+3 new</span>
              </div>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <FileText className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Response Time</p>
              <p className="text-2xl font-bold text-gray-900">{avgResponseTime.toFixed(1)} days</p>
              <div className="flex items-center mt-1">
                <TrendingDown className="h-4 w-4 text-green-600 mr-1" />
                <span className="text-sm text-green-600">-0.5 days</span>
              </div>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Approval Rate</p>
              <p className="text-2xl font-bold text-gray-900">78%</p>
              <div className="flex items-center mt-1">
                <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                <span className="text-sm text-green-600">+5%</span>
              </div>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs and Search */}
      <Card className="p-5 bg-white/60 backdrop-blur-sm border border-slate-200/60">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex items-center space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${
                  selectedTab === tab.id
                    ? 'bg-blue-100 text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search quotes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 pr-4 py-2.5 bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200"
              />
            </div>
            <Button className="bg-white/80 backdrop-blur-sm border border-slate-200/60 text-slate-700 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200 flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </Button>
            {selectedQuotes.length > 0 && (
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 flex items-center space-x-2">
                <GitCompare className="h-4 w-4" />
                <span>Compare ({selectedQuotes.length})</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Quotes List */}
      <div className="space-y-4">
        {filteredQuotes.map((quote) => {
          const StatusIcon = statusConfig[quote.status as keyof typeof statusConfig].icon;
          const isExpiring = isExpiringSoon(quote.validUntil);
          
          return (
            <Card key={quote.id} className="p-6 bg-white/60 backdrop-blur-sm border border-slate-200/60 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-4">
                  <input
                    type="checkbox"
                    checked={selectedQuotes.includes(quote.id)}
                    onChange={() => handleQuoteSelection(quote.id)}
                    className="mt-1"
                  />
                  <div>
                    <div className="flex items-center space-x-3 mb-3">
                      <h3 className="font-semibold text-lg text-slate-800">{quote.title}</h3>
                      {isExpiring && (
                        <Badge className="bg-orange-100 text-orange-800 font-medium">
                          Expires Soon
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-slate-600 mb-4 font-medium">
                      <span>{quote.id}</span>
                      <span>•</span>
                      <span>Req: {quote.requisitionId}</span>
                      <span>•</span>
                      <span className="flex items-center">
                        <Building className="h-4 w-4 mr-1" />
                        {quote.vendor}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="bg-slate-50/50 p-3 rounded-lg">
                        <span className="text-slate-500 font-medium">Items:</span>
                        <span className="ml-1 font-semibold text-slate-800">{quote.itemCount}</span>
                      </div>
                      <div className="bg-slate-50/50 p-3 rounded-lg">
                        <span className="text-slate-500 font-medium">Payment:</span>
                        <span className="ml-1 font-semibold text-slate-800">{quote.paymentTerms}</span>
                      </div>
                      <div className="bg-slate-50/50 p-3 rounded-lg">
                        <span className="text-slate-500 font-medium">Delivery:</span>
                        <span className="ml-1 font-semibold text-slate-800">{quote.deliveryTime}</span>
                      </div>
                      <div className="bg-slate-50/50 p-3 rounded-lg">
                        <span className="text-slate-500 font-medium">Response:</span>
                        <span className="ml-1 font-semibold text-slate-800">{quote.responseTime}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center space-x-3 mb-2">
                    <Badge className={statusConfig[quote.status as keyof typeof statusConfig].color}>
                      <StatusIcon className="h-4 w-4 mr-1" />
                      {statusConfig[quote.status as keyof typeof statusConfig].label}
                    </Badge>
                  </div>
                  <div className="mb-3">
                    <p className="text-2xl font-bold text-slate-800">
                      ${quote.totalAmount.toLocaleString()}
                    </p>
                    {quote.discount > 0 && (
                      <p className="text-sm text-emerald-600 font-semibold">
                        {quote.discount}% discount applied
                      </p>
                    )}
                  </div>
                  <div className="text-sm text-slate-500">
                    <div className="flex items-center font-medium">
                      <Calendar className="h-4 w-4 mr-1" />
                      Valid until {formatDate(quote.validUntil)}
                    </div>
                  </div>
                </div>
              </div>

              {quote.notes && (
                <div className="mb-5 p-4 bg-slate-50/50 rounded-lg border border-slate-100">
                  <p className="text-sm text-slate-700 font-medium">{quote.notes}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-5 border-t border-slate-200">
                <div className="flex items-center space-x-4 text-sm text-slate-600 font-medium">
                  <span>Submitted: {formatDate(quote.submittedDate)}</span>
                  <span>•</span>
                  <span>Vendor Rating: ⭐ {quote.vendor_rating}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button className="bg-white/80 border border-slate-200 text-slate-700 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200 p-2">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button className="bg-white/80 border border-slate-200 text-slate-700 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200 p-2">
                    <Download className="h-4 w-4" />
                  </Button>
                  {quote.status === 'pending' && (
                    <>
                      <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 px-4 py-2">
                        Approve
                      </Button>
                      <Button className="bg-white/80 border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all duration-200 px-4 py-2">
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredQuotes.length === 0 && (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No quotes found
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm ? 'Try adjusting your search terms' : 'No quotes match the selected filters'}
          </p>
          <Button className="flex items-center space-x-2 mx-auto">
            <Plus className="h-4 w-4" />
            <span>Request New Quote</span>
          </Button>
        </Card>
      )}
    </div>
  );
};