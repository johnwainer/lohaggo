const LOGO_URL = 'https://www.lohaggo.com/icon-512.png'
const APP_URL = 'https://www.lohaggo.com'
const BRAND_COLOR = '#0a66c2'
const BRAND_GRADIENT = 'linear-gradient(135deg,#0a66c2 0%,#00bfa6 100%)'

export type EmailLayoutOptions = {
  title: string
  preheader?: string
  body: string
  ctaLabel?: string
  ctaUrl?: string
  footerNote?: string
}

export function buildEmailHtml(opts: EmailLayoutOptions): string {
  const year = new Date().getFullYear()
  const preheader = opts.preheader || opts.title

  const cta = opts.ctaLabel && opts.ctaUrl
    ? `<tr><td style="padding:0 0 24px;">
        <a href="${opts.ctaUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.01em;">${opts.ctaLabel}</a>
      </td></tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>${opts.title}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">

  <!-- preheader hidden text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f0f4f8;line-height:1px;">
    ${preheader}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f0f4f8;padding:32px 0;">
    <tr>
      <td align="center" style="padding:0 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">

          <!-- HEADER -->
          <tr>
            <td style="background:${BRAND_GRADIENT};border-radius:16px 16px 0 0;padding:28px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <a href="${APP_URL}" style="text-decoration:none;display:inline-flex;align-items:center;gap:10px;">
                      <img src="${LOGO_URL}" alt="LoHaggo" width="44" height="44"
                           style="width:44px;height:44px;border-radius:10px;display:block;border:0;"/>
                      <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.02em;vertical-align:middle;">LoHaggo</span>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="background:#ffffff;padding:36px 32px 28px;border-left:1px solid #dce8f5;border-right:1px solid #dce8f5;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color:#0f172a;font-size:22px;font-weight:800;line-height:1.25;padding-bottom:18px;">
                    ${opts.title}
                  </td>
                </tr>
                <tr>
                  <td style="color:#334155;font-size:15px;line-height:1.65;padding-bottom:24px;">
                    ${opts.body}
                  </td>
                </tr>
                ${cta}
                ${opts.footerNote ? `<tr><td style="color:#64748b;font-size:13px;line-height:1.55;padding-top:8px;border-top:1px solid #e2e8f0;">${opts.footerNote}</td></tr>` : ''}
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#f8fafc;border:1px solid #dce8f5;border-top:none;border-radius:0 0 16px 16px;padding:18px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color:#94a3b8;font-size:12px;line-height:1.6;">
                    <img src="${LOGO_URL}" alt="" width="20" height="20"
                         style="width:20px;height:20px;border-radius:4px;display:inline-block;vertical-align:middle;margin-right:6px;border:0;"/>
                    <strong style="color:#64748b;">LoHaggo</strong> · Medellín, Colombia ·
                    <a href="${APP_URL}" style="color:#0a66c2;text-decoration:none;">www.lohaggo.com</a>
                    <br/>
                    © ${year} LoHaggo. Todos los derechos reservados.
                    Este mensaje fue enviado automáticamente, por favor no responder.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Wrap a plain-text or partial-HTML body in the full email layout */
export function wrapBodyInEmailLayout(rawBody: string, title = 'LoHaggo'): string {
  // Already a full HTML document — return as-is
  if (rawBody.trimStart().toLowerCase().startsWith('<!doctype') || rawBody.trimStart().toLowerCase().startsWith('<html')) {
    return rawBody
  }
  // Convert newlines to <br> for plain-text bodies
  const htmlBody = rawBody.includes('<') ? rawBody : rawBody.replace(/\n/g, '<br/>')
  return buildEmailHtml({ title, body: htmlBody })
}
