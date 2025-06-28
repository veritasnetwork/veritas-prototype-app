export interface User {
  id: string;
  address?: string; // Web3 wallet address
  email?: string;
  username?: string;
  createdAt: string;
  isProvider: boolean;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
