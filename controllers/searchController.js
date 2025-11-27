// searchController.js
import searchService from '../services/searchService.js';

// البحث الأساسي
export const search = async (req, res) => {
  try {
    const {
      query,
      type = 'all',
      filter = 'relevance',
      page = 1,
      limit = 10
    } = req.query;

    const userId = req.user?.id;
    const offset = (page - 1) * limit;

    // تنظيف واستخراج الهاشتاجات
    const hashtags = query?.match(/#[\w\u0600-\u06FF]+/g) || [];
    const cleanQuery = query?.replace(/#[\w\u0600-\u06FF]+/g, '').trim() || '';

    let videos = [];
    let users = [];
    let trendingHashtags = [];

    // البحث عن الفيديوهات
    if (type === 'all' || type === 'videos') {
      videos = await searchService.searchVideos({
        query: cleanQuery,
        hashtags,
        filter,
        userId,
        limit: parseInt(limit),
        offset
      });
    }

    // البحث عن المستخدمين
    if (type === 'all' || type === 'users') {
      users = await searchService.searchUsers({
        query: cleanQuery,
        userId,
        limit: parseInt(limit),
        offset
      });
    }

    // الحصول على الهاشتاجات الرائجة إذا كان البحث يحتوي على هاشتاجات
    if (hashtags.length > 0 || filter === 'hashtags') {
      trendingHashtags = await searchService.getTrendingHashtags(5);
    }

    // تسجيل تاريخ البحث إذا كان المستخدم مسجل الدخول
    if (userId && cleanQuery) {
      await searchService.recordSearchHistory(userId, cleanQuery, type);
    }

    const hasMore = (videos.length === parseInt(limit) || users.length === parseInt(limit));

    res.json({
      success: true,
      videos,
      users,
      hashtags: trendingHashtags,
      hasMore,
      totalCount: videos.length + users.length
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message
    });
  }
};

// البحث بالهاشتاجات
export const searchHashtags = async (req, res) => {
  try {
    const { hashtag, page = 1, limit = 10 } = req.query;
    const userId = req.user?.id;
    const offset = (page - 1) * limit;

    const videos = await searchService.searchByHashtag(hashtag, userId, parseInt(limit), offset);

    res.json({
      success: true,
      videos,
      hashtag,
      hasMore: videos.length === parseInt(limit)
    });
  } catch (error) {
    console.error('Hashtag search error:', error);
    res.status(500).json({
      success: false,
      message: 'Hashtag search failed',
      error: error.message
    });
  }
};

// الحصول على الهاشتاجات الرائجة
export const getTrendingHashtags = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const hashtags = await searchService.getTrendingHashtags(parseInt(limit));

    res.json({
      success: true,
      hashtags
    });
  } catch (error) {
    console.error('Trending hashtags error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trending hashtags',
      error: error.message
    });
  }
};

// الاقتراحات التلقائية
export const getSuggestions = async (req, res) => {
  try {
    const { q: query, limit = 5 } = req.query;
    
    if (!query || query.length < 2) {
      return res.json({ success: true, suggestions: [] });
    }

    const suggestions = await searchService.getSearchSuggestions(query, parseInt(limit));

    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get suggestions',
      error: error.message
    });
  }
};

// تسجيل تفاعل البحث
export const recordInteraction = async (req, res) => {
  try {
    const { videoId, type, weight = 1.0, metadata } = req.body;
    const userId = req.user.id;

    await searchService.recordSearchInteraction(userId, videoId, type, weight, metadata);

    res.json({
      success: true,
      message: 'Interaction recorded'
    });
  } catch (error) {
    console.error('Record interaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record interaction',
      error: error.message
    });
  }
};

// استعراض تاريخ البحث
export const getSearchHistory = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const userId = req.user.id;

    const history = await searchService.getUserSearchHistory(userId, parseInt(limit));

    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Search history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get search history',
      error: error.message
    });
  }
};

// مسح تاريخ البحث
export const clearSearchHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    await searchService.clearUserSearchHistory(userId);

    res.json({
      success: true,
      message: 'Search history cleared'
    });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear search history',
      error: error.message
    });
  }
};

// التوصيات بناءً على البحث
export const getSearchRecommendations = async (req, res) => {
  try {
    const { q: query, limit = 5 } = req.query;
    const userId = req.user?.id;

    const recommendations = await searchService.getSearchBasedRecommendations(query, userId, parseInt(limit));

    res.json({
      success: true,
      recommendations
    });
  } catch (error) {
    console.error('Search recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get search recommendations',
      error: error.message
    });
  }
};