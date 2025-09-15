import React, { useState, useEffect } from 'react';
import { useHelp, HelpArticle, HelpCategory } from './HelpProvider';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { 
  Search, 
  HelpCircle, 
  BookOpen, 
  Play, 
  Clock, 
  Star, 
  ThumbsUp, 
  ThumbsDown,
  Flag,
  Lightbulb,
  ChevronRight,
  Download,
  Video,
  FileText,
  Image,
  ExternalLink,
  Bookmark,
  BookmarkCheck
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const HelpCenter: React.FC = () => {
  const {
    articles,
    categories,
    tours,
    searchArticles,
    getArticle,
    getArticlesByCategory,
    getPopularArticles,
    getRecentArticles,
    startTour,
    markArticleAsHelpful,
    reportIssue,
    suggestImprovement,
    trackArticleView,
    getUserProgress,
    isLoading
  } = useHelp();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'issue' | 'suggestion'>('issue');
  const [feedbackText, setFeedbackText] = useState('');
  const [bookmarkedArticles, setBookmarkedArticles] = useState<string[]>([]);

  const userProgress = getUserProgress();

  useEffect(() => {
    if (searchQuery.trim()) {
      const results = searchArticles(searchQuery);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchArticles]);

  useEffect(() => {
    setBookmarkedArticles(userProgress.bookmarkedArticles);
  }, [userProgress]);

  const handleArticleClick = (article: HelpArticle) => {
    setSelectedArticle(article);
    trackArticleView(article.id);
  };

  const handleStartTour = (tourId: string) => {
    startTour(tourId);
  };

  const handleFeedback = async () => {
    if (selectedArticle && feedbackText.trim()) {
      if (feedbackType === 'issue') {
        await reportIssue(selectedArticle.id, feedbackText);
      } else {
        await suggestImprovement(selectedArticle.id, feedbackText);
      }
      setFeedbackText('');
      setShowFeedbackDialog(false);
    }
  };

  const toggleBookmark = (articleId: string) => {
    const newBookmarks = bookmarkedArticles.includes(articleId)
      ? bookmarkedArticles.filter(id => id !== articleId)
      : [...bookmarkedArticles, articleId];
    
    setBookmarkedArticles(newBookmarks);
    // Save to user progress
    localStorage.setItem('help-progress', JSON.stringify({
      ...userProgress,
      bookmarkedArticles: newBookmarks
    }));
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAttachmentIcon = (type: string) => {
    switch (type) {
      case 'pdf':
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'image':
        return <Image className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading help content...</div>;
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-6 w-6" />
            FlowMarine Help Center
          </CardTitle>
          <p className="text-muted-foreground">
            Find answers, learn new features, and get the most out of FlowMarine
          </p>
        </CardHeader>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help articles..."
              className="pl-10"
            />
          </div>
          
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="font-medium">Search Results</h3>
              {searchResults.map(result => (
                <Card 
                  key={result.article.id} 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleArticleClick(result.article)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{result.article.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {result.matchedContent}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={getDifficultyColor(result.article.difficulty)}>
                            {result.article.difficulty}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {result.article.estimatedReadTime} min read
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Start</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tours.map(tour => (
                <Button
                  key={tour.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleStartTour(tour.id)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {tour.name}
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Categories</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {categories.map(category => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  {category.name}
                  <Badge variant="secondary" className="ml-auto">
                    {category.articles.length}
                  </Badge>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Popular Articles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="h-4 w-4" />
                Popular Articles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {getPopularArticles().map(article => (
                <Button
                  key={article.id}
                  variant="ghost"
                  className="w-full justify-start text-left h-auto p-2"
                  onClick={() => handleArticleClick(article)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{article.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {article.estimatedReadTime} min read
                    </p>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2">
          {selectedArticle ? (
            /* Article View */
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {selectedArticle.title}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleBookmark(selectedArticle.id)}
                      >
                        {bookmarkedArticles.includes(selectedArticle.id) ? (
                          <BookmarkCheck className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Bookmark className="h-4 w-4" />
                        )}
                      </Button>
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={getDifficultyColor(selectedArticle.difficulty)}>
                        {selectedArticle.difficulty}
                      </Badge>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {selectedArticle.estimatedReadTime} min read
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Updated {formatDistanceToNow(selectedArticle.lastUpdated, { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedArticle(null)}
                  >
                    Back
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Video */}
                {selectedArticle.videoUrl && (
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <Button variant="outline" asChild>
                      <a href={selectedArticle.videoUrl} target="_blank" rel="noopener noreferrer">
                        <Video className="h-4 w-4 mr-2" />
                        Watch Video
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </Button>
                  </div>
                )}

                {/* Content */}
                <div className="prose prose-sm max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: selectedArticle.content.replace(/\n/g, '<br>') }} />
                </div>

                {/* Attachments */}
                {selectedArticle.attachments && selectedArticle.attachments.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-medium">Attachments</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {selectedArticle.attachments.map(attachment => (
                        <Button
                          key={attachment.id}
                          variant="outline"
                          className="justify-start"
                          asChild
                        >
                          <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                            {getAttachmentIcon(attachment.type)}
                            <span className="ml-2 flex-1 text-left">
                              {attachment.name}
                              <span className="text-xs text-muted-foreground block">
                                {(attachment.size / 1024 / 1024).toFixed(1)} MB
                              </span>
                            </span>
                            <Download className="h-3 w-3 ml-2" />
                          </a>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {selectedArticle.tags.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-medium">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedArticle.tags.map(tag => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Related Articles */}
                {selectedArticle.relatedArticles.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-medium">Related Articles</h3>
                    <div className="space-y-2">
                      {selectedArticle.relatedArticles.map(articleId => {
                        const relatedArticle = getArticle(articleId);
                        if (!relatedArticle) return null;
                        
                        return (
                          <Button
                            key={articleId}
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => handleArticleClick(relatedArticle)}
                          >
                            <BookOpen className="h-4 w-4 mr-2" />
                            {relatedArticle.title}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Feedback */}
                <div className="border-t pt-6">
                  <h3 className="font-medium mb-4">Was this article helpful?</h3>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markArticleAsHelpful(selectedArticle.id)}
                    >
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      Yes
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFeedbackType('issue');
                        setShowFeedbackDialog(true);
                      }}
                    >
                      <ThumbsDown className="h-4 w-4 mr-2" />
                      No
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFeedbackType('suggestion');
                        setShowFeedbackDialog(true);
                      }}
                    >
                      <Lightbulb className="h-4 w-4 mr-2" />
                      Suggest Improvement
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFeedbackType('issue');
                        setShowFeedbackDialog(true);
                      }}
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      Report Issue
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Browse View */
            <Tabs defaultValue="browse" className="w-full">
              <TabsList>
                <TabsTrigger value="browse">Browse</TabsTrigger>
                <TabsTrigger value="recent">Recent</TabsTrigger>
                <TabsTrigger value="bookmarks">Bookmarks</TabsTrigger>
              </TabsList>

              <TabsContent value="browse">
                <div className="space-y-4">
                  {selectedCategory ? (
                    <div>
                      <h2 className="text-xl font-semibold mb-4">
                        {categories.find(c => c.id === selectedCategory)?.name}
                      </h2>
                      <div className="grid gap-4">
                        {getArticlesByCategory(selectedCategory).map(article => (
                          <Card 
                            key={article.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => handleArticleClick(article)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="font-medium">{article.title}</h3>
                                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                    {article.content.substring(0, 150)}...
                                  </p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge className={getDifficultyColor(article.difficulty)}>
                                      {article.difficulty}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {article.estimatedReadTime} min read
                                    </span>
                                    {userProgress.articlesRead.includes(article.id) && (
                                      <Badge variant="secondary">Read</Badge>
                                    )}
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-6">
                      {categories.map(category => (
                        <Card key={category.id}>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <BookOpen className="h-5 w-5" />
                              {category.name}
                            </CardTitle>
                            <p className="text-muted-foreground">{category.description}</p>
                          </CardHeader>
                          <CardContent>
                            <div className="grid gap-2">
                              {getArticlesByCategory(category.id).slice(0, 3).map(article => (
                                <Button
                                  key={article.id}
                                  variant="ghost"
                                  className="justify-start"
                                  onClick={() => handleArticleClick(article)}
                                >
                                  {article.title}
                                </Button>
                              ))}
                              {category.articles.length > 3 && (
                                <Button
                                  variant="outline"
                                  onClick={() => setSelectedCategory(category.id)}
                                >
                                  View all {category.articles.length} articles
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="recent">
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold">Recently Updated</h2>
                  <div className="grid gap-4">
                    {getRecentArticles().map(article => (
                      <Card 
                        key={article.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleArticleClick(article)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium">{article.title}</h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                Updated {formatDistanceToNow(article.lastUpdated, { addSuffix: true })}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="bookmarks">
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold">Bookmarked Articles</h2>
                  {bookmarkedArticles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bookmark className="h-8 w-8 mx-auto mb-2" />
                      <p>No bookmarked articles yet</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {bookmarkedArticles.map(articleId => {
                        const article = getArticle(articleId);
                        if (!article) return null;
                        
                        return (
                          <Card 
                            key={article.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => handleArticleClick(article)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="font-medium">{article.title}</h3>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge className={getDifficultyColor(article.difficulty)}>
                                      {article.difficulty}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {article.estimatedReadTime} min read
                                    </span>
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {feedbackType === 'issue' ? 'Report Issue' : 'Suggest Improvement'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                {feedbackType === 'issue' 
                  ? 'What issue did you encounter?' 
                  : 'How can we improve this article?'
                }
              </Label>
              <Textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={
                  feedbackType === 'issue'
                    ? 'Describe the issue you found...'
                    : 'Share your suggestions for improvement...'
                }
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowFeedbackDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleFeedback}>
                Submit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};