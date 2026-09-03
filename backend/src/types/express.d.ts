declare global {
  namespace Express {
    interface AuthContext {
      sessionId: string;
      userId: string;
      email: string;
      fullName: string;
      title: string | null;
      room: string | null;
      mustChangePassword: boolean;
      roles: string[];
      permissions: string[];
    }

    interface Request {
      requestId: string;
      auth?: AuthContext;
    }
  }
}

export {};
