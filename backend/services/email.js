/**
 * EmailService — notifications par email (nodemailer)
 */

import nodemailer from 'nodemailer';
import { config } from '../config/config.js';

class EmailService {
  getTransporter() {
    if (!config.smtp.host) return null;

    return nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined
    });
  }

  async send({ to, subject, text, html }) {
    const transporter = this.getTransporter();
    if (!transporter) {
      console.warn('[Email] SMTP not configured, skipping email to:', to);
      return;
    }

    try {
      await transporter.sendMail({
        from: `"${config.smtp.fromName}" <${config.smtp.fromEmail}>`,
        to,
        subject,
        text,
        html
      });
      console.log('[Email] Sent to:', to, '|', subject);
    } catch (error) {
      console.error('[Email] Send failed:', error.message);
    }
  }

  async sendVMProvisioned(user, vm) {
    await this.send({
      to: user.email,
      subject: `Your server "${vm.name}" is ready — NebulaHosting`,
      text: `Hello ${user.display_name},\n\nYour server "${vm.name}" has been provisioned successfully!\n\nType: ${vm.vm_type.toUpperCase()}\nIP: ${vm.ip_address || 'DHCP pending'}\n\nManage it at ${config.frontendUrl}/vms/${vm.id}\n\nNebula Team`,
      html: `<p>Hello ${user.display_name},</p><p>Your server <strong>${vm.name}</strong> has been provisioned!</p><p>Manage it <a href="${config.frontendUrl}/vms/${vm.id}">here</a>.</p>`
    });
  }

  async sendPaymentFailed(user, vm) {
    await this.send({
      to: user.email,
      subject: `Payment failed — your server "${vm?.name}" has been suspended`,
      text: `Hello ${user.display_name},\n\nWe were unable to collect your payment. Your server has been suspended.\n\nPlease update your payment method at ${config.frontendUrl}/billing\n\nNebula Team`,
      html: `<p>Hello ${user.display_name},</p><p>Payment failed. Your server has been suspended. Please <a href="${config.frontendUrl}/billing">update your payment method</a>.</p>`
    });
  }
}

export const emailService = new EmailService();
