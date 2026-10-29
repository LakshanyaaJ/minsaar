import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}
