export class User {
    id: string; // uuid v4
  login: string;
  password: string;
  role: UserRole;
  createdAt: number;
  updatedAt: number; 
}

export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

