import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface UserPayload {
      id: number;
      companyId: number | null;
      role: Role;
      email: string;
    }
    // Extiende Request para incluir user
    interface Request {
      user?: UserPayload;
    }
  }
}
export {};
