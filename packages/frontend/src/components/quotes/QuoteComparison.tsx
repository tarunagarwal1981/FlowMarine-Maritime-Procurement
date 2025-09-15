import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

interface VendorScore {
  vendorId: string;
  vendorName: string;
  quoteId: string;
  scores: {
    priceScore: number;
    deliveryScore: number;
    qualityScore: number;
    locationScore: number;
    totalScore: number;
  };
  ranking: number;
  recommendation: 'HIGHLY_RECOMMENDED' | 'RECOMMENDED' | 'ACCEPTABLE' | 'NOT_RECOMMENDED';
  totalAmount: number;
  currency: string;
  deliveryDate?: Date;
  notes?: string;
}

interface QuoteComparisonReport {
  rfqId: string;
  rfqTitle: string;
  totalQuotes: number;
  scoredQuotes: VendorScore[];
  recommendedQuote: VendorScore;
  comparisonMatrix: any[];
  scoringCriteria: {
    priceWeight: number;
    deliveryWeight: number;
    qualityWeight: number;
    locationWeight: number;
  };
  generatedAt: Date;
}

const QuoteComparison: React.FC = () => {
  const { rfqId } = useParams<{ rfqId: string }>();
  const [report, setReport] = useState<QuoteComparisonReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuotes, setSelectedQuotes] = useState<string[]>([]);
  const [showScoringWeights, setShowScoringWeights] = useState(false);
  const [customWeights, setCustomWeights] = useState({
    price: 0.4,
    delivery: 0.3,
    quality: 0.2,
    location: 0.1
  });

  useEffect(() => {
    if (rfqId) {
      fetchComparisonReport();
    }
  }, [rfqId]);

  const fetchComparisonReport = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/quote-comparison/${rfqId}/report`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch comparison report');
      }

      const data = await response.json();
      setReport(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleScoreQuotes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/quote-comparison/${rfqId}/score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ scoringWeights: customWeights })
      });

      if (!response.ok) {
        throw new Error('Failed to score quotes');
      }

      const data = await response.json();
      setReport(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveQuote = async (quoteId: string, justification: string) => {
    try {
      const response = await fetch(`/api/quote-comparison/quotes/${quoteId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ justification })
      });

      if (!response.ok) {
        throw new Error('Failed to approve quote');
      }

      // Refresh the report
      await fetchComparisonReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'HIGHLY_RECOMMENDED':
        return 'text-green-600 bg-green-100';
      case 'RECOMMENDED':
        return 'text-blue-600 bg-blue-100';
      case 'ACCEPTABLE':
        return 'text-yellow-600 bg-yellow-100';
      case 'NOT_RECOMMENDED':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-4">No Quote Comparison Available</h3>
        <p className="text-gray-600 mb-6">Score the quotes to generate a comparison report.</p>
        <button
          onClick={handleScoreQuotes}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Score Quotes
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{report.rfqTitle}</h1>
            <p className="text-gray-600 mt-1">Quote Comparison Report</p>
            <div className="mt-2 text-sm text-gray-500">
              Generated: {new Date(report.generatedAt).toLocaleString()}
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowScoringWeights(!showScoringWeights)}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
            >
              Adjust Weights
            </button>
            <button
              onClick={handleScoreQuotes}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Re-score Quotes
            </button>
          </div>
        </div>
      </div>

      {/* Scoring Weights Panel */}
      {showScoringWeights && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Scoring Weights</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Price</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={customWeights.price}
                onChange={(e) => setCustomWeights({ ...customWeights, price: parseFloat(e.target.value) })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Delivery</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={customWeights.delivery}
                onChange={(e) => setCustomWeights({ ...customWeights, delivery: parseFloat(e.target.value) })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Quality</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={customWeights.quality}
                onChange={(e) => setCustomWeights({ ...customWeights, quality: parseFloat(e.target.value) })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Location</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={customWeights.location}
                onChange={(e) => setCustomWeights({ ...customWeights, location: parseFloat(e.target.value) })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Total: {(customWeights.price + customWeights.delivery + customWeights.quality + customWeights.location).toFixed(1)}
            {Math.abs((customWeights.price + customWeights.delivery + customWeights.quality + customWeights.location) - 1.0) > 0.01 && (
              <span className="text-red-600 ml-2">Weights must sum to 1.0</span>
            )}
          </div>
        </div>
      )}

      {/* Recommended Quote */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-green-800 mb-4">Recommended Quote</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h4 className="font-medium text-green-900">{report.recommendedQuote.vendorName}</h4>
            <p className="text-green-700">
              {report.recommendedQuote.currency} {report.recommendedQuote.totalAmount.toLocaleString()}
            </p>
            <p className="text-sm text-green-600">
              Delivery: {report.recommendedQuote.deliveryDate ? 
                new Date(report.recommendedQuote.deliveryDate).toDateString() : 'TBD'}
            </p>
          </div>
          <div>
            <div className="text-sm text-green-700">
              <div>Price Score: <span className={getScoreColor(report.recommendedQuote.scores.priceScore)}>
                {report.recommendedQuote.scores.priceScore.toFixed(1)}</span></div>
              <div>Delivery Score: <span className={getScoreColor(report.recommendedQuote.scores.deliveryScore)}>
                {report.recommendedQuote.scores.deliveryScore.toFixed(1)}</span></div>
              <div>Quality Score: <span className={getScoreColor(report.recommendedQuote.scores.qualityScore)}>
                {report.recommendedQuote.scores.qualityScore.toFixed(1)}</span></div>
              <div>Location Score: <span className={getScoreColor(report.recommendedQuote.scores.locationScore)}>
                {report.recommendedQuote.scores.locationScore.toFixed(1)}</span></div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-green-800">
                {report.recommendedQuote.scores.totalScore.toFixed(1)}
              </div>
              <div className="text-sm text-green-600">Total Score</div>
            </div>
            <button
              onClick={() => {
                const justification = prompt('Please provide justification for approving this quote:');
                if (justification) {
                  handleApproveQuote(report.recommendedQuote.quoteId, justification);
                }
              }}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            >
              Approve Quote
            </button>
          </div>
        </div>
      </div>

      {/* All Quotes Comparison */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">All Quotes Comparison</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Delivery Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Delivery Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quality Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recommendation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {report.scoredQuotes.map((quote) => (
                <tr key={quote.quoteId} className={quote.ranking === 1 ? 'bg-green-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{quote.ranking}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {quote.vendorName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {quote.currency} {quote.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {quote.deliveryDate ? new Date(quote.deliveryDate).toDateString() : 'TBD'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={getScoreColor(quote.scores.priceScore)}>
                      {quote.scores.priceScore.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={getScoreColor(quote.scores.deliveryScore)}>
                      {quote.scores.deliveryScore.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={getScoreColor(quote.scores.qualityScore)}>
                      {quote.scores.qualityScore.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={getScoreColor(quote.scores.locationScore)}>
                      {quote.scores.locationScore.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <span className={getScoreColor(quote.scores.totalScore)}>
                      {quote.scores.totalScore.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRecommendationColor(quote.recommendation)}`}>
                      {quote.recommendation.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => {
                        const justification = prompt('Please provide justification for approving this quote:');
                        if (justification) {
                          handleApproveQuote(quote.quoteId, justification);
                        }
                      }}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setSelectedQuotes([...selectedQuotes, quote.quoteId])}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      Compare
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scoring Criteria */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Scoring Criteria</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {(report.scoringCriteria.priceWeight * 100).toFixed(0)}%
            </div>
            <div className="text-sm text-gray-600">Price</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {(report.scoringCriteria.deliveryWeight * 100).toFixed(0)}%
            </div>
            <div className="text-sm text-gray-600">Delivery</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {(report.scoringCriteria.qualityWeight * 100).toFixed(0)}%
            </div>
            <div className="text-sm text-gray-600">Quality</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {(report.scoringCriteria.locationWeight * 100).toFixed(0)}%
            </div>
            <div className="text-sm text-gray-600">Location</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteComparison;