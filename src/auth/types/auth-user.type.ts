export type AuthUser = {
  userId: string;
  login: string;
  role: 'admin' | 'editor' | 'viewer';
};
