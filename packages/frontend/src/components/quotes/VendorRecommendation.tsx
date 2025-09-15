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

interface VendorRecommendation {
  recommendedVendor: VendorScore;
  alternatives: VendorScore[];
  reasoning: string[];
}

const VendorRecommendation: React.FC = () => {
  const { rfqId } = useParams<{ rfqId: string }>();
  const [recommendation, setRecommendation] = useState<VendorRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (rfqId) {
      fetchRecommendation();
    }
  }, [rfqId]);

  const fetchRecommendation = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/quote-comparison/${rfqId}/recommendation`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch vendor recommendation');
      }

      const data = await response.json();
      setRecommendation(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRecommendation = async () => {
    if (!recommendation) return;

    const justification = prompt('Please provide justification for approving the recommended vendor:');
    if (!justification) return;

    try {
      const response = await fetch(`/api/quote-comparison/quotes/${recommendation.recommendedVendor.quoteId}/approve`, {
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

      alert('Quote approved successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'HIGHLY_RECOMMENDED':
        return '🌟';
      case 'RECOMMENDED':
        return '👍';
      case 'ACCEPTABLE':
        return '✅';
      case 'NOT_RECOMMENDED':
        return '❌';
      default:
        return '❓';
    }
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'HIGHLY_RECOMMENDED':
        return 'text-green-600 bg-green-100 border-green-200';
      case 'RECOMMENDED':
        return 'text-blue-600 bg-blue-100 border-blue-200';
      case 'ACCEPTABLE':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'NOT_RECOMMENDED':
        return 'text-red-600 bg-red-100 border-red-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200';
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

  if (!recommendation) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-4">No Recommendation Available</h3>
        <p className="text-gray-600">Please score the quotes first to get a vendor recommendation.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Recommended Vendor Card */}
      <div className={`border-2 rounded-lg p-6 ${getRecommendationColor(recommendation.recommendedVendor.recommendation)}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="text-3xl">
              {getRecommendationIcon(recommendation.recommendedVendor.recommendation)}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {recommendation.recommendedVendor.vendorName}
              </h2>
              <p className="text-lg font-medium">
                {recommendation.recommendedVendor.currency} {recommendation.recommendedVendor.totalAmount.toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">
                Delivery: {recommendation.recommendedVendor.deliveryDate ? 
                  new Date(recommendation.recommendedVendor.deliveryDate).toDateString() : 'TBD'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900">
              {recommendation.recommendedVendor.scores.totalScore.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">Total Score</div>
            <div className="text-sm font-medium text-gray-700">
              Rank #{recommendation.recommendedVendor.ranking}
            </div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`text-xl font-bold ${getScoreColor(recommendation.recommendedVendor.scores.priceScore)}`}>
              {recommendation.recommendedVendor.scores.priceScore.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">Price Score</div>
          </div>
          <div className="text-center">
            <div className={`text-xl font-bold ${getScoreColor(recommendation.recommendedVendor.scores.deliveryScore)}`}>
              {recommendation.recommendedVendor.scores.deliveryScore.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">Delivery Score</div>
          </div>
          <div className="text-center">
            <div className={`text-xl font-bold ${getScoreColor(recommendation.recommendedVendor.scores.qualityScore)}`}>
              {recommendation.recommendedVendor.scores.qualityScore.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">Quality Score</div>
          </div>
          <div className="text-center">
            <div className={`text-xl font-bold ${getScoreColor(recommendation.recommendedVendor.scores.locationScore)}`}>
              {recommendation.recommendedVendor.scores.locationScore.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">Location Score</div>
          </div>
        </div>

        {/* Reasoning */}
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Why This Vendor is Recommended:</h3>
          <ul className="space-y-2">
            {recommendation.reasoning.map((reason, index) => (
              <li key={index} className="flex items-center space-x-2">
                <span className="text-green-500">✓</span>
                <span className="text-gray-700">{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex space-x-3">
          <button
            onClick={handleApproveRecommendation}
            className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 font-medium"
          >
            Approve Recommendation
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-200 font-medium"
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
        </div>

        {/* Additional Details */}
        {showDetails && recommendation.recommendedVendor.notes && (
          <div className="mt-4 p-4 bg-white bg-opacity-50 rounded-md">
            <h4 className="font-medium text-gray-900 mb-2">Additional Notes:</h4>
            <p className="text-gray-700">{recommendation.recommendedVendor.notes}</p>
          </div>
        )}
      </div>

      {/* Alternative Vendors */}
      {recommendation.alternatives.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Alternative Vendors</h3>
          <div className="space-y-4">
            {recommendation.alternatives.map((vendor, index) => (
              <div key={vendor.quoteId} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-lg font-medium text-gray-900">
                      #{vendor.ranking} {vendor.vendorName}
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRecommendationColor(vendor.recommendation)}`}>
                      {vendor.recommendation.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {vendor.currency} {vendor.totalAmount.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">
                      Score: {vendor.scores.totalScore.toFixed(1)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Price: </span>
                    <span className={getScoreColor(vendor.scores.priceScore)}>
                      {vendor.scores.priceScore.toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Delivery: </span>
                    <span className={getScoreColor(vendor.scores.deliveryScore)}>
                      {vendor.scores.deliveryScore.toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Quality: </span>
                    <span className={getScoreColor(vendor.scores.qualityScore)}>
                      {vendor.scores.qualityScore.toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Location: </span>
                    <span className={getScoreColor(vendor.scores.locationScore)}>
                      {vendor.scores.locationScore.toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    Delivery: {vendor.deliveryDate ? 
                      new Date(vendor.deliveryDate).toDateString() : 'TBD'}
                  </div>
                  <button
                    onClick={() => {
                      const justification = prompt('Please provide justification for selecting this alternative vendor:');
                      if (justification) {
                        // Handle alternative vendor selection
                        console.log('Alternative vendor selected:', vendor.vendorName);
                      }
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Select Alternative
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-blue-900 mb-3">Recommendation Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="font-medium text-blue-900">Best Overall Value</div>
            <div className="text-blue-700">{recommendation.recommendedVendor.vendorName}</div>
          </div>
          <div>
            <div className="font-medium text-blue-900">Total Score</div>
            <div className="text-blue-700">{recommendation.recommendedVendor.scores.totalScore.toFixed(1)} / 10</div>
          </div>
          <div>
            <div className="font-medium text-blue-900">Confidence Level</div>
            <div className="text-blue-700">
              {recommendation.recommendedVendor.scores.totalScore >= 8.5 ? 'Very High' :
               recommendation.recommendedVendor.scores.totalScore >= 7.0 ? 'High' :
               recommendation.recommendedVendor.scores.totalScore >= 5.5 ? 'Medium' : 'Low'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorRecommendation;