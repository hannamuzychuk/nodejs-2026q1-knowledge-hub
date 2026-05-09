export const usersRoutes = {
  getAll: '/user',
  getById: (userId) => `/user/${userId}`,
  create: '/user',
  update: (userId) => `/user/${userId}`,
  delete: (userId) => `/user/${userId}`,
};

export const categoriesRoutes = {
  getAll: '/category',
  getById: (categoryId) => `/category/${categoryId}`,
  create: '/category',
  update: (categoryId) => `/category/${categoryId}`,
  delete: (categoryId) => `/category/${categoryId}`,
};

export const articlesRoutes = {
  getAll: '/article',
  getById: (articleId) => `/article/${articleId}`,
  create: '/article',
  update: (articleId) => `/article/${articleId}`,
  delete: (articleId) => `/article/${articleId}`,
};

export const commentsRoutes = {
  getByArticle: (articleId) => `/comment?articleId=${articleId}`,
  getById: (commentId) => `/comment/${commentId}`,
  create: '/comment',
  delete: (commentId) => `/comment/${commentId}`,
};

export const authRoutes = {
  signup: '/auth/signup',
  login: '/auth/login',
  refresh: '/auth/refresh',
};

export const aiRoutes = {
  summarize: (articleId: string) => `/ai/articles/${articleId}/summarize`,
  translate: (articleId: string) => `/ai/articles/${articleId}/translate`,
  analyze: (articleId: string) => `/ai/articles/${articleId}/analyze`,
  generate: () => '/ai/generate',
  usage: () => '/ai/usage',
};

export const ragRoutes = {
  index: () => '/ai/rag/index',
  search: () => '/ai/rag/search',
  chat: () => '/ai/rag/chat',
  deleteIndexedArticle: (articleId: string) =>
    `/ai/rag/index/articles/${articleId}`,
  history: (conversationId: string) =>
    `/ai/rag/chat/${conversationId}/history`,
};
