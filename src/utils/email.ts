import nodemailer from 'nodemailer';
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

let transporter: nodemailer.Transporter | null = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

export async function sendProvisionalPassword(to: string, pass: string) {
  const subject = 'Tu contraseña provisoria (48h)';
  const text = `Se ha creado tu cuenta. Contraseña provisoria: ${pass}
Debes cambiarla dentro de 48 horas desde tu primer ingreso.`;
  if (!transporter) {
    console.log('=== EMAIL DEV ===');
    console.log('PARA:', to);
    console.log('ASUNTO:', subject);
    console.log(text);
    console.log('=================');
    return;
  }
  await transporter.sendMail({
    from: SMTP_FROM || 'no-reply@kolder.local',
    to,
    subject,
    text
  });
}
