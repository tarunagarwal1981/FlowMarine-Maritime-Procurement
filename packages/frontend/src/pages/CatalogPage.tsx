import React, { useState } from 'react';
import { 
  Search, 
  Grid, 
  List, 
  Star,
  ShoppingCart,
  Eye,
  Package,
  Wrench,
  Shield,
  Navigation,
  Utensils,
  Zap,
  Heart
} from 'lucide-react';
import { Card, Badge, Button } from '../components/ui';

export const CatalogPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const categories = [
    { id: 'all', name: 'All Categories', icon: Package, count: 1247 },
    { id: 'engine', name: 'Engine Parts', icon: Wrench, count: 324 },
    { id: 'safety', name: 'Safety Equipment', icon: Shield, count: 189 },
    { id: 'navigation', name: 'Navigation', icon: Navigation, count: 156 },
    { id: 'galley', name: 'Galley Supplies', icon: Utensils, count: 234 },
    { id: 'electrical', name: 'Electrical', icon: Zap, count: 198 },
    { id: 'deck', name: 'Deck Equipment', icon: Package, count: 146 }
  ];

  const catalogItems = [
    {
      id: 'ENG-001',
      name: 'Marine Engine Oil SAE 40',
      category: 'Engine Parts',
      brand: 'Shell Rimula',
      price: 45.99,
      unit: 'Liter',
      rating: 4.8,
      reviews: 124,
      inStock: true,
      stockLevel: 'High',
      image: '/api/placeholder/200/200',
      description: 'High-performance marine engine oil for heavy-duty applications',
      specifications: ['SAE 40 viscosity', 'API CF-4 certified', 'Marine grade'],
      vendor: 'Maritime Supply Co.'
    },
    {
      id: 'SAF-001',
      name: 'SOLAS Life Jacket Adult',
      category: 'Safety Equipment',
      brand: 'Survitec',
      price: 89.99,
      unit: 'Piece',
      rating: 4.9,
      reviews: 89,
      inStock: true,
      stockLevel: 'Medium',
      image: '/api/placeholder/200/200',
      description: 'SOLAS approved life jacket with reflective tape and whistle',
      specifications: ['SOLAS 2010 compliant', 'Adult size', 'CE marked'],
      vendor: 'Ocean Safety Ltd.'
    },
    {
      id: 'NAV-001',
      name: 'GPS Chart Plotter 12"',
      category: 'Navigation',
      brand: 'Furuno',
      price: 2499.99,
      unit: 'Piece',
      rating: 4.7,
      reviews: 45,
      inStock: true,
      stockLevel: 'Low',
      image: '/api/placeholder/200/200',
      description: 'Professional marine GPS chart plotter with 12" display',
      specifications: ['12" color display', 'GPS/WAAS', 'Chart compatible'],
      vendor: 'Nautical Electronics'
    },
    {
      id: 'FIL-001',
      name: 'Fuel Filter Element',
      category: 'Engine Parts',
      brand: 'Caterpillar',
      price: 125.50,
      unit: 'Piece',
      rating: 4.6,
      reviews: 78,
      inStock: true,
      stockLevel: 'High',
      image: '/api/placeholder/200/200',
      description: 'OEM fuel filter element for CAT marine engines',
      specifications: ['OEM quality', 'CAT 3512 compatible', 'High efficiency'],
      vendor: 'Engine Parts Direct'
    },
    {
      id: 'DEC-001',
      name: 'Mooring Rope 24mm',
      category: 'Deck Equipment',
      brand: 'Marlow Ropes',
      price: 12.75,
      unit: 'Meter',
      rating: 4.5,
      reviews: 156,
      inStock: true,
      stockLevel: 'High',
      image: '/api/placeholder/200/200',
      description: 'High-strength polypropylene mooring rope',
      specifications: ['24mm diameter', '6.5 ton breaking strength', 'UV resistant'],
      vendor: 'Marine Rope Co.'
    },
    {
      id: 'ELE-001',
      name: 'LED Navigation Light',
      category: 'Electrical',
      brand: 'Hella Marine',
      price: 189.99,
      unit: 'Piece',
      rating: 4.8,
      reviews: 67,
      inStock: false,
      stockLevel: 'Out of Stock',
      image: '/api/placeholder/200/200',
      description: 'LED masthead navigation light with low power consumption',
      specifications: ['LED technology', 'IP67 rated', 'COLREG compliant'],
      vendor: 'Marine Electronics Pro'
    },
    {
      id: 'GAL-001',
      name: 'Commercial Blender 2L',
      category: 'Galley Supplies',
      brand: 'Vitamix',
      price: 449.99,
      unit: 'Piece',
      rating: 4.9,
      reviews: 34,
      inStock: true,
      stockLevel: 'Medium',
      image: '/api/placeholder/200/200',
      description: 'Heavy-duty commercial blender for galley use',
      specifications: ['2L capacity', 'Variable speed', 'Marine grade'],
      vendor: 'Galley Equipment Ltd.'
    },
    {
      id: 'SAF-002',
      name: 'Emergency Flare Kit',
      category: 'Safety Equipment',
      brand: 'Pains Wessex',
      price: 89.50,
      unit: 'Kit',
      rating: 4.7,
      reviews: 92,
      inStock: true,
      stockLevel: 'High',
      image: '/api/placeholder/200/200',
      description: 'Complete emergency flare kit with red hand flares',
      specifications: ['SOLAS approved', '12 red flares', '3-year shelf life'],
      vendor: 'Safety Equipment Co.'
    }
  ];

  const filteredItems = catalogItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || 
      item.category.toLowerCase().includes(selectedCategory);
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case 'price-low': return a.price - b.price;
      case 'price-high': return b.price - a.price;
      case 'rating': return b.rating - a.rating;
      case 'name': return a.name.localeCompare(b.name);
      default: return 0;
    }
  });

  const getStockColor = (stockLevel: string) => {
    switch (stockLevel) {
      case 'High': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-orange-100 text-orange-800';
      case 'Out of Stock': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-800">Parts Catalog</h1>
          <p className="text-slate-600 mt-2">
            Browse and order maritime parts and equipment
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button className="bg-white/80 backdrop-blur-sm border border-slate-200/60 text-slate-700 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200 flex items-center space-x-2">
            <Heart className="h-4 w-4" />
            <span>Favorites</span>
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all duration-200 flex items-center space-x-2">
            <ShoppingCart className="h-4 w-4" />
            <span>Cart (3)</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card className="p-6 bg-white/60 backdrop-blur-sm border border-slate-200/60">
            <h3 className="font-semibold text-lg mb-6 text-slate-800">Categories</h3>
            <div className="space-y-2">
              {categories.map((category) => {
                const IconComponent = category.icon;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all duration-200 ${
                      selectedCategory === category.id
                        ? 'bg-blue-100 text-blue-900 shadow-sm'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-1.5 rounded-lg ${selectedCategory === category.id ? 'bg-blue-200' : 'bg-slate-100'}`}>
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <Badge className={`${selectedCategory === category.id ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-600'} font-medium`}>
                      {category.count}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Filters */}
          <Card className="p-6 mt-6 bg-white/60 backdrop-blur-sm border border-slate-200/60">
            <h3 className="font-semibold text-lg mb-6 text-slate-800">Filters</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Price Range
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    placeholder="Min"
                    className="w-full px-3 py-2.5 bg-white/80 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200"
                  />
                  <span className="text-slate-500">-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    className="w-full px-3 py-2.5 bg-white/80 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Brand
                </label>
                <div className="space-y-3">
                  {['Shell', 'Caterpillar', 'Furuno', 'Survitec'].map((brand) => (
                    <label key={brand} className="flex items-center group cursor-pointer">
                      <input type="checkbox" className="mr-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20" />
                      <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">{brand}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Availability
                </label>
                <div className="space-y-3">
                  <label className="flex items-center group cursor-pointer">
                    <input type="checkbox" className="mr-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20" defaultChecked />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">In Stock</span>
                  </label>
                  <label className="flex items-center group cursor-pointer">
                    <input type="checkbox" className="mr-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20" />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">Include Out of Stock</span>
                  </label>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Search and Controls */}
          <Card className="p-5 mb-6 bg-white/60 backdrop-blur-sm border border-slate-200/60">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search parts, brands, or item codes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-3 bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200 text-sm font-medium text-slate-700"
                >
                  <option value="name">Sort by Name</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                </select>
                
                <div className="flex items-center bg-white/80 border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2.5 transition-all duration-200 ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <Grid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2.5 transition-all duration-200 ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Results */}
          <div className="mb-6">
            <p className="text-slate-600 font-medium">
              Showing {sortedItems.length} of {catalogItems.length} items
            </p>
          </div>

          {/* Items Grid/List */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {sortedItems.map((item) => (
                <Card key={item.id} className="p-6 bg-white/60 backdrop-blur-sm border border-slate-200/60 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 group">
                  <div className="aspect-square bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl mb-5 flex items-center justify-center group-hover:from-slate-100 group-hover:to-slate-150 transition-all duration-300">
                    <Package className="h-16 w-16 text-slate-400 group-hover:text-slate-500 transition-colors duration-300" />
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg text-slate-800 group-hover:text-slate-900 transition-colors">{item.name}</h3>
                      <p className="text-sm text-slate-600 font-medium">{item.id} • {item.brand}</p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center">
                        {renderStars(item.rating)}
                      </div>
                      <span className="text-sm text-slate-600 font-medium">({item.reviews})</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-slate-800">
                          ${item.price}
                        </p>
                        <p className="text-sm text-slate-500 font-medium">per {item.unit}</p>
                      </div>
                      <Badge className={getStockColor(item.stockLevel)}>
                        {item.stockLevel}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button 
                        className={`flex-1 ${item.inStock ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25' : 'bg-slate-300 text-slate-500 cursor-not-allowed'} transition-all duration-200`}
                        disabled={!item.inStock}
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Add to Cart
                      </Button>
                      <Button className="bg-white/80 border border-slate-200 text-slate-700 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200 p-2.5">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {sortedItems.map((item) => (
                <Card key={item.id} className="p-6">
                  <div className="flex items-center space-x-6">
                    <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Package className="h-8 w-8 text-gray-400" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900">{item.name}</h3>
                          <p className="text-sm text-gray-600 mb-2">{item.id} • {item.brand}</p>
                          <p className="text-sm text-gray-700 mb-2">{item.description}</p>
                          
                          <div className="flex items-center space-x-4 mb-2">
                            <div className="flex items-center space-x-1">
                              {renderStars(item.rating)}
                              <span className="text-sm text-gray-600">({item.reviews})</span>
                            </div>
                            <Badge className={getStockColor(item.stockLevel)}>
                              {item.stockLevel}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span>Vendor: {item.vendor}</span>
                            <span>Category: {item.category}</span>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900 mb-1">
                            ${item.price}
                          </p>
                          <p className="text-sm text-gray-500 mb-4">per {item.unit}</p>
                          
                          <div className="flex items-center space-x-2">
                            <Button 
                              disabled={!item.inStock}
                              className="flex items-center space-x-2"
                            >
                              <ShoppingCart className="h-4 w-4" />
                              <span>Add to Cart</span>
                            </Button>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};