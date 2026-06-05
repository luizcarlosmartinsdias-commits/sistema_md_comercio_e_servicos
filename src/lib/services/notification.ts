import { NotificationChannel, PrismaClient } from '@prisma/client';

type SendInput = { serviceRequestId?: string; recipient: string; subject: string; body: string };

export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  async email(input: SendInput) { return this.log(NotificationChannel.EMAIL, process.env.EMAIL_PROVIDER ?? 'mock', input); }
  async whatsapp(input: SendInput) { return this.log(NotificationChannel.WHATSAPP, process.env.WHATSAPP_PROVIDER ?? 'mock', input); }
  async internal(input: SendInput) { return this.log(NotificationChannel.INTERNAL, 'internal', input); }

  async notifyMd(subject: string, body: string, serviceRequestId?: string) {
    await this.email({ serviceRequestId, recipient: process.env.MD_NOTIFICATION_EMAIL ?? 'md@example.local', subject, body });
    await this.whatsapp({ serviceRequestId, recipient: process.env.MD_WHATSAPP_NUMBER ?? 'mock-whatsapp-md', subject, body });
    await this.internal({ serviceRequestId, recipient: 'ADMIN_MD', subject, body });
  }

  private async log(channel: NotificationChannel, provider: string, input: SendInput) {
    if (provider === 'mock') console.info(`[mock:${channel}]`, input.subject, input.recipient);
    return this.prisma.notificationLog.create({ data: { channel, provider, recipient: input.recipient, subject: input.subject, body: input.body, serviceRequestId: input.serviceRequestId } });
  }
}
