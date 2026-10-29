import { prisma } from '../config/db';
import { Setting } from '@prisma/client';

export class SettingRepository {
  async get(key: string): Promise<any | null> {
    const record = await prisma.setting.findUnique({ where: { key } });
    return record?.value ?? null;
  }

  async set(key: string, value: any): Promise<Setting> {
    return prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

export const settingRepository = new SettingRepository();
