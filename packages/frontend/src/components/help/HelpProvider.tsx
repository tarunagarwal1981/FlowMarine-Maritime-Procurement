import React, { createContext, useContext, useState, useEffect } from 'react';

export interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  lastUpdated: Date;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedReadTime: number;
  relatedArticles: string[];
  attachments?: HelpAttachment[];
  videoUrl?: string;
  interactive?: boolean;
}

export interface HelpAttachment {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'video' | 'document';
  url: string;
  size: number;
}

export interface HelpCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  articles: string[];
  subcategories?: HelpCategory[];
}

export interface HelpTour {
  id: string;
  name: string;
  description: string;
  steps: HelpTourStep[];
  targetPage: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedDuration: number;
}

export interface HelpTourStep {
  id: string;
  title: string;
  content: string;
  target: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'hover' | 'focus' | 'none';
  optional?: boolean;
}

export interface HelpSearchResult {
  article: HelpArticle;
  relevanceScore: number;
  matchedContent: string;
}

interface HelpContextType {
  articles: HelpArticle[];
  categories: HelpCategory[];
  tours: HelpTour[];
  searchArticles: (query: string) => HelpSearchResult[];
  getArticle: (id: string) => HelpArticle | undefined;
  getCategory: (id: string) => HelpCategory | undefined;
  getTour: (id: string) => HelpTour | undefined;
  getArticlesByCategory: (categoryId: string) => HelpArticle[];
  getPopularArticles: () => HelpArticle[];
  getRecentArticles: () => HelpArticle[];
  startTour: (tourId: string) => void;
  stopTour: () => void;
  currentTour: HelpTour | null;
  currentTourStep: number;
  nextTourStep: () => void;
  previousTourStep: () => void;
  skipTour: () => void;
  markArticleAsHelpful: (articleId: string) => void;
  reportIssue: (articleId: string, issue: string) => void;
  suggestImprovement: (articleId: string, suggestion: string) => void;
  trackArticleView: (articleId: string) => void;
  getUserProgress: () => HelpProgress;
  isLoading: boolean;
}

export interface HelpProgress {
  articlesRead: string[];
  toursCompleted: string[];
  bookmarkedArticles: string[];
  searchHistory: string[];
  lastVisited: Date;
}

const HelpContext = createContext<HelpContextType | undefined>(undefined);

export const useHelp = () => {
  const context = useContext(HelpContext);
  if (!context) {
    throw new Error('useHelp must be used within HelpProvider');
  }
  return context;
};

interface HelpProviderProps {
  children: React.ReactNode;
}

export const HelpProvider: React.FC<HelpProviderProps> = ({ children }) => {
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [tours, setTours] = useState<HelpTour[]>([]);
  const [currentTour, setCurrentTour] = useState<HelpTour | null>(null);
  const [currentTourStep, setCurrentTourStep] = useState(0);
  const [userProgress, setUserProgress] = useState<HelpProgress>({
    articlesRead: [],
    toursCompleted: [],
    bookmarkedArticles: [],
    searchHistory: [],
    lastVisited: new Date()
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHelpContent();
    loadUserProgress();
  }, []);

  const loadHelpContent = async () => {
    try {
      setIsLoading(true);
      
      // Load articles
      const articlesResponse = await fetch('/api/help/articles');
      if (articlesResponse.ok) {
        const articlesData = await articlesResponse.json();
        setArticles(articlesData.map((article: any) => ({
          ...article,
          lastUpdated: new Date(article.lastUpdated)
        })));
      }

      // Load categories
      const categoriesResponse = await fetch('/api/help/categories');
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json();
        setCategories(categoriesData);
      }

      // Load tours
      const toursResponse = await fetch('/api/help/tours');
      if (toursResponse.ok) {
        const toursData = await toursResponse.json();
        setTours(toursData);
      }

      // Fallback to default content if API fails
      if (!articlesResponse.ok) {
        setArticles(getDefaultArticles());
      }
      if (!categoriesResponse.ok) {
        setCategories(getDefaultCategories());
      }
      if (!toursResponse.ok) {
        setTours(getDefaultTours());
      }
    } catch (error) {
      console.error('Failed to load help content:', error);
      // Load default content
      setArticles(getDefaultArticles());
      setCategories(getDefaultCategories());
      setTours(getDefaultTours());
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserProgress = () => {
    const saved = localStorage.getItem('help-progress');
    if (saved) {
      const progress = JSON.parse(saved);
      setUserProgress({
        ...progress,
        lastVisited: new Date(progress.lastVisited)
      });
    }
  };

  const saveUserProgress = (progress: HelpProgress) => {
    setUserProgress(progress);
    localStorage.setItem('help-progress', JSON.stringify(progress));
  };

  const searchArticles = (query: string): HelpSearchResult[] => {
    if (!query.trim()) return [];

    const results: HelpSearchResult[] = [];
    const searchTerms = query.toLowerCase().split(' ');

    articles.forEach(article => {
      let relevanceScore = 0;
      let matchedContent = '';

      // Search in title (higher weight)
      const titleMatches = searchTerms.filter(term => 
        article.title.toLowerCase().includes(term)
      );
      relevanceScore += titleMatches.length * 3;

      // Search in content
      const contentMatches = searchTerms.filter(term => 
        article.content.toLowerCase().includes(term)
      );
      relevanceScore += contentMatches.length;

      // Search in tags
      const tagMatches = searchTerms.filter(term => 
        article.tags.some(tag => tag.toLowerCase().includes(term))
      );
      relevanceScore += tagMatches.length * 2;

      if (relevanceScore > 0) {
        // Extract matched content snippet
        const contentLower = article.content.toLowerCase();
        const firstMatch = searchTerms.find(term => contentLower.includes(term));
        if (firstMatch) {
          const index = contentLower.indexOf(firstMatch);
          const start = Math.max(0, index - 50);
          const end = Math.min(article.content.length, index + 150);
          matchedContent = article.content.substring(start, end);
          if (start > 0) matchedContent = '...' + matchedContent;
          if (end < article.content.length) matchedContent += '...';
        }

        results.push({
          article,
          relevanceScore,
          matchedContent
        });
      }
    });

    // Sort by relevance score
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  };

  const getArticle = (id: string) => {
    return articles.find(article => article.id === id);
  };

  const getCategory = (id: string) => {
    return categories.find(category => category.id === id);
  };

  const getTour = (id: string) => {
    return tours.find(tour => tour.id === id);
  };

  const getArticlesByCategory = (categoryId: string) => {
    const category = getCategory(categoryId);
    if (!category) return [];
    
    return articles.filter(article => 
      category.articles.includes(article.id)
    );
  };

  const getPopularArticles = () => {
    // In a real implementation, this would be based on view counts
    return articles.slice(0, 5);
  };

  const getRecentArticles = () => {
    return [...articles]
      .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
      .slice(0, 5);
  };

  const startTour = (tourId: string) => {
    const tour = getTour(tourId);
    if (tour) {
      setCurrentTour(tour);
      setCurrentTourStep(0);
    }
  };

  const stopTour = () => {
    if (currentTour) {
      // Mark tour as completed if user finished it
      if (currentTourStep >= currentTour.steps.length - 1) {
        const newProgress = {
          ...userProgress,
          toursCompleted: [...userProgress.toursCompleted, currentTour.id]
        };
        saveUserProgress(newProgress);
      }
    }
    setCurrentTour(null);
    setCurrentTourStep(0);
  };

  const nextTourStep = () => {
    if (currentTour && currentTourStep < currentTour.steps.length - 1) {
      setCurrentTourStep(prev => prev + 1);
    } else {
      stopTour();
    }
  };

  const previousTourStep = () => {
    if (currentTourStep > 0) {
      setCurrentTourStep(prev => prev - 1);
    }
  };

  const skipTour = () => {
    stopTour();
  };

  const markArticleAsHelpful = async (articleId: string) => {
    try {
      await fetch(`/api/help/articles/${articleId}/helpful`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (error) {
      console.error('Failed to mark article as helpful:', error);
    }
  };

  const reportIssue = async (articleId: string, issue: string) => {
    try {
      await fetch(`/api/help/articles/${articleId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ issue })
      });
    } catch (error) {
      console.error('Failed to report issue:', error);
    }
  };

  const suggestImprovement = async (articleId: string, suggestion: string) => {
    try {
      await fetch(`/api/help/articles/${articleId}/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ suggestion })
      });
    } catch (error) {
      console.error('Failed to suggest improvement:', error);
    }
  };

  const trackArticleView = (articleId: string) => {
    const newProgress = {
      ...userProgress,
      articlesRead: [...new Set([...userProgress.articlesRead, articleId])],
      lastVisited: new Date()
    };
    saveUserProgress(newProgress);

    // Track on server
    fetch(`/api/help/articles/${articleId}/view`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    }).catch(console.error);
  };

  const getUserProgress = () => userProgress;

  return (
    <HelpContext.Provider
      value={{
        articles,
        categories,
        tours,
        searchArticles,
        getArticle,
        getCategory,
        getTour,
        getArticlesByCategory,
        getPopularArticles,
        getRecentArticles,
        startTour,
        stopTour,
        currentTour,
        currentTourStep,
        nextTourStep,
        previousTourStep,
        skipTour,
        markArticleAsHelpful,
        reportIssue,
        suggestImprovement,
        trackArticleView,
        getUserProgress,
        isLoading
      }}
    >
      {children}
    </HelpContext.Provider>
  );
};

// Default content for fallback
const getDefaultArticles = (): HelpArticle[] => [
  {
    id: 'getting-started',
    title: 'Getting Started with FlowMarine',
    content: `Welcome to FlowMarine! This guide will help you get started with the maritime procurement platform.

## Overview
FlowMarine is designed to streamline your maritime procurement processes, from requisitions to payments.

## First Steps
1. Complete your profile setup
2. Configure your vessel information
3. Set up your approval workflows
4. Add your vendors

## Key Features
- **Requisition Management**: Create and track procurement requests
- **Vendor Management**: Manage supplier relationships
- **Approval Workflows**: Automated approval processes
- **Real-time Analytics**: Monitor spending and performance`,
    category: 'getting-started',
    tags: ['basics', 'introduction', 'setup'],
    lastUpdated: new Date(),
    difficulty: 'beginner',
    estimatedReadTime: 5,
    relatedArticles: ['vessel-setup', 'creating-requisitions']
  },
  {
    id: 'creating-requisitions',
    title: 'Creating Your First Requisition',
    content: `Learn how to create procurement requisitions in FlowMarine.

## Step-by-Step Guide
1. Navigate to the Requisitions page
2. Click "New Requisition"
3. Select your vessel
4. Add items from the catalog
5. Set delivery requirements
6. Submit for approval

## Tips
- Use IMPA/ISSA codes for accurate item identification
- Set appropriate urgency levels
- Include detailed delivery instructions`,
    category: 'requisitions',
    tags: ['requisitions', 'procurement', 'tutorial'],
    lastUpdated: new Date(),
    difficulty: 'beginner',
    estimatedReadTime: 8,
    relatedArticles: ['getting-started', 'approval-workflows']
  }
];

const getDefaultCategories = (): HelpCategory[] => [
  {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'Learn the basics of FlowMarine',
    icon: 'play-circle',
    articles: ['getting-started']
  },
  {
    id: 'requisitions',
    name: 'Requisitions',
    description: 'Managing procurement requests',
    icon: 'file-text',
    articles: ['creating-requisitions']
  },
  {
    id: 'vendors',
    name: 'Vendor Management',
    description: 'Working with suppliers',
    icon: 'users',
    articles: []
  },
  {
    id: 'analytics',
    name: 'Analytics & Reporting',
    description: 'Understanding your data',
    icon: 'bar-chart',
    articles: []
  }
];

const getDefaultTours = (): HelpTour[] => [
  {
    id: 'dashboard-tour',
    name: 'Dashboard Overview',
    description: 'Get familiar with the main dashboard',
    targetPage: '/dashboard',
    difficulty: 'beginner',
    estimatedDuration: 3,
    steps: [
      {
        id: 'welcome',
        title: 'Welcome to FlowMarine',
        content: 'This tour will show you around the main dashboard',
        target: 'body',
        position: 'bottom'
      },
      {
        id: 'navigation',
        title: 'Navigation Menu',
        content: 'Use this menu to navigate between different sections',
        target: '[data-tour="navigation"]',
        position: 'right'
      },
      {
        id: 'notifications',
        title: 'Notifications',
        content: 'Stay updated with important alerts and messages',
        target: '[data-tour="notifications"]',
        position: 'bottom'
      }
    ]
  }
];