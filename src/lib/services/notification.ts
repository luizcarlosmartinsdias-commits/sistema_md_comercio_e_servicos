import { NotificationChannel, PrismaClient } from '@prisma/client';
import { Resend } from 'resend';

type SendInput = { serviceRequestId?: string; recipient: string; subject: string; body: string };

type NotificationStatus = 'MOCKED' | 'SENT' | 'FAILED';

export class NotificationService {
  constructor(private prisma: PrismaClient) {}

  async email(input: SendInput) {
    const provider = (process.env.EMAIL_PROVIDER ?? 'mock').toLowerCase();
    if (provider === 'resend') return this.sendResendEmail(input);
    return this.log(NotificationChannel.EMAIL, provider, input, 'MOCKED');
  }

  async whatsapp(input: SendInput) { return this.log(NotificationChannel.WHATSAPP, process.env.WHATSAPP_PROVIDER ?? 'mock', input, 'MOCKED'); }
  async internal(input: SendInput) { return this.log(NotificationChannel.INTERNAL, 'internal', input, 'SENT'); }

  async notifyMd(subject: string, body: string, serviceRequestId?: string) {
    await this.email({ serviceRequestId, recipient: process.env.MD_NOTIFICATION_EMAIL ?? 'md@example.local', subject, body });
    await this.whatsapp({ serviceRequestId, recipient: process.env.MD_WHATSAPP_NUMBER ?? 'mock-whatsapp-md', subject, body });
    await this.internal({ serviceRequestId, recipient: 'ADMIN_MD', subject, body });
  }

  private async sendResendEmail(input: SendInput) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (!apiKey || !from) {
      const message = 'EMAIL_PROVIDER=resend exige RESEND_API_KEY e EMAIL_FROM configurados.';
      console.error('[notification:resend] Configuracao ausente', { hasApiKey: Boolean(apiKey), hasEmailFrom: Boolean(from) });
      await this.log(NotificationChannel.EMAIL, 'resend', input, 'FAILED');
      throw new Error(message);
    }

    const resend = new Resend(apiKey);
    let response: Awaited<ReturnType<typeof resend.emails.send>>;

    try {
      response = await resend.emails.send({
        from,
        to: input.recipient,
        subject: input.subject,
        text: input.body
      });
    } catch (error) {
      await this.logResendFailure(input, error);
      throw error;
    }

    if (response.error) {
      const message = response.error.message || 'Falha desconhecida ao enviar email pelo Resend.';
      await this.logResendFailure(input, new Error(message));
      throw new Error(message);
    }

    console.info('[notification:resend] Email enviado', {
      recipient: input.recipient,
      subject: input.subject,
      serviceRequestId: input.serviceRequestId,
      resendEmailId: response.data?.id
    });

    return this.log(NotificationChannel.EMAIL, 'resend', input, 'SENT');
  }

  private async logResendFailure(input: SendInput, error: unknown) {
    if (error instanceof Error) {
      console.error('[notification:resend] Falha ao enviar email', {
        recipient: input.recipient,
        subject: input.subject,
        serviceRequestId: input.serviceRequestId,
        error: error.message
      });
    } else {
      console.error('[notification:resend] Falha inesperada ao enviar email', { recipient: input.recipient, subject: input.subject, serviceRequestId: input.serviceRequestId });
    }

    await this.log(NotificationChannel.EMAIL, 'resend', input, 'FAILED');
  }

  private async log(channel: NotificationChannel, provider: string, input: SendInput, status: NotificationStatus) {
    if (provider === 'mock') console.info(`[mock:${channel}]`, input.subject, input.recipient);
    return this.prisma.notificationLog.create({ data: { channel, provider, recipient: input.recipient, subject: input.subject, body: input.body, serviceRequestId: input.serviceRequestId, status } });
  }
}
