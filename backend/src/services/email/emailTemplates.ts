export interface MatchedJobAlertItem {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: string;
  experience: string;
  descriptionSnippet: string;
  relevanceScore: number;
  relevanceTier: string;
  reasons: string[];
  jobUrl: string;
}

export class EmailTemplates {
  private static baseStyle = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    line-height: 1.6;
    background-color: #f8fafc;
    margin: 0;
    padding: 0;
  `;

  private static containerStyle = `
    max-width: 600px;
    margin: 24px auto;
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  `;

  private static headerStyle = `
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
    padding: 24px 32px;
    text-align: left;
  `;

  private static bodyStyle = `
    padding: 32px;
  `;

  private static footerStyle = `
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    padding: 20px 32px;
    font-size: 12px;
    color: #64748b;
    text-align: center;
  `;

  private static buttonStyle = `
    display: inline-block;
    background: #4f46e5;
    color: #ffffff !important;
    font-weight: 600;
    font-size: 14px;
    padding: 12px 24px;
    text-decoration: none;
    border-radius: 8px;
    margin-top: 16px;
    box-shadow: 0 2px 4px rgba(79, 70, 229, 0.25);
  `;

  public static signupOtp(otp: string, expiresMinutes = 10): { html: string; text: string } {
    const text = `Welcome to Pilot Mama!\n\nYour 6-digit email verification code is: ${otp}\n\nThis code will expire in ${expiresMinutes} minutes.\nIf you did not request this code, please ignore this email.`;

    const html = `
      <div style="${this.baseStyle}">
        <div style="${this.containerStyle}">
          <div style="${this.headerStyle}">
            <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">
              🚀 Pilot Mama
            </h2>
            <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">AI Job Application Copilot</p>
          </div>
          <div style="${this.bodyStyle}">
            <h3 style="color: #0f172a; margin-top: 0; font-size: 18px;">Verify your email address</h3>
            <p style="color: #475569; font-size: 15px;">Welcome! Please enter the following 6-digit verification code to activate your Pilot Mama account and start your job search:</p>
            
            <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; border: 1px dashed #cbd5e1;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4f46e5; font-family: monospace;">
                ${otp}
              </span>
            </div>

            <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">
              ⏱️ This code expires in <strong>${expiresMinutes} minutes</strong> and can only be used once. Never share this code with anyone.
            </p>
          </div>
          <div style="${this.footerStyle}">
            <p style="margin: 0;">Pilot Mama &bull; Autonomous Career Navigation &bull; Zero Fabrication</p>
            <p style="margin: 4px 0 0 0;">If you did not create an account, you can safely disregard this email.</p>
          </div>
        </div>
      </div>
    `;

    return { html, text };
  }

  public static loginOtp(otp: string, expiresMinutes = 10): { html: string; text: string } {
    const text = `Pilot Mama Login Code\n\nYour 6-digit login verification code is: ${otp}\n\nThis code will expire in ${expiresMinutes} minutes.\nIf you did not attempt to sign in, your account is secure and you can ignore this email.`;

    const html = `
      <div style="${this.baseStyle}">
        <div style="${this.containerStyle}">
          <div style="${this.headerStyle}">
            <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">
              🚀 Pilot Mama
            </h2>
            <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">AI Job Application Copilot</p>
          </div>
          <div style="${this.bodyStyle}">
            <h3 style="color: #0f172a; margin-top: 0; font-size: 18px;">Your login verification code</h3>
            <p style="color: #475569; font-size: 15px;">Use this 6-digit code to complete your sign-in to Pilot Mama:</p>
            
            <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; border: 1px dashed #cbd5e1;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4f46e5; font-family: monospace;">
                ${otp}
              </span>
            </div>

            <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">
              ⏱️ Valid for <strong>${expiresMinutes} minutes</strong>. If you did not request this login, someone may have entered your email address by mistake.
            </p>
          </div>
          <div style="${this.footerStyle}">
            <p style="margin: 0;">Pilot Mama &bull; Secure Passwordless Authentication</p>
          </div>
        </div>
      </div>
    `;

    return { html, text };
  }

  public static passwordResetOtp(otp: string, expiresMinutes = 10): { html: string; text: string } {
    const text = `Reset Your Pilot Mama Password\n\nYour 6-digit password reset verification code is: ${otp}\n\nThis code will expire in ${expiresMinutes} minutes.\nIf you did not request a password reset, please ignore this email.`;

    const html = `
      <div style="${this.baseStyle}">
        <div style="${this.containerStyle}">
          <div style="${this.headerStyle}">
            <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">
              🚀 Pilot Mama
            </h2>
            <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">Security Notification</p>
          </div>
          <div style="${this.bodyStyle}">
            <h3 style="color: #0f172a; margin-top: 0; font-size: 18px;">Reset your password</h3>
            <p style="color: #475569; font-size: 15px;">We received a request to reset the password for your account. Enter this code to verify your identity:</p>
            
            <div style="background: #fef2f2; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; border: 1px dashed #fca5a5;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #dc2626; font-family: monospace;">
                ${otp}
              </span>
            </div>

            <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">
              ⏱️ Expires in <strong>${expiresMinutes} minutes</strong>. If you did not make this request, your account remains secure and you can disregard this email.
            </p>
          </div>
          <div style="${this.footerStyle}">
            <p style="margin: 0;">Pilot Mama Security Team</p>
          </div>
        </div>
      </div>
    `;

    return { html, text };
  }

  public static newJobAlert(
    candidateFirstName: string,
    jobs: MatchedJobAlertItem[],
    unsubscribeUrl: string
  ): { subject: string; html: string; text: string } {
    const isSingle = jobs.length === 1;
    const topJob = jobs[0];

    const subject = isSingle
      ? `New job matched to your profile: ${topJob.title} at ${topJob.company}`
      : `${jobs.length} new jobs match your Pilot Mama profile`;

    let text = `Hello ${candidateFirstName},\n\n`;
    text += isSingle
      ? `A new job matching your profile was just discovered on Pilot Mama:\n\n`
      : `${jobs.length} newly discovered jobs match your Pilot Mama profile:\n\n`;

    jobs.forEach((j, idx) => {
      text += `[${idx + 1}] ${j.title} at ${j.company}\n`;
      text += `Location: ${j.location} (${j.workMode}) | Experience: ${j.experience}\n`;
      text += `Match Score: ${j.relevanceScore}%\n`;
      if (j.reasons && j.reasons.length > 0) {
        text += `Why this matches:\n${j.reasons.map(r => `• ${r}`).join('\n')}\n`;
      }
      text += `View & Apply: ${j.jobUrl}\n\n`;
    });

    text += `\nTo unsubscribe from new job alerts: ${unsubscribeUrl}\n`;

    const jobsHtml = jobs
      .map(
        j => `
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <h4 style="margin: 0 0 4px 0; color: #0f172a; font-size: 16px; font-weight: 700;">${j.title}</h4>
              <p style="margin: 0; color: #475569; font-size: 14px; font-weight: 600;">${j.company}</p>
            </div>
            <span style="background: #ecfdf5; color: #059669; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 12px; border: 1px solid #a7f3d0;">
              ${j.relevanceScore}% Match
            </span>
          </div>

          <p style="margin: 8px 0; color: #64748b; font-size: 13px;">
            📍 ${j.location} &bull; 💼 ${j.workMode} &bull; ⏱️ ${j.experience}
          </p>

          ${
            j.descriptionSnippet
              ? `<p style="margin: 8px 0 12px 0; color: #334155; font-size: 13px; line-height: 1.5;">${j.descriptionSnippet}</p>`
              : ''
          }

          ${
            j.reasons && j.reasons.length > 0
              ? `
            <div style="background: #f8fafc; border-left: 3px solid #4f46e5; padding: 10px 14px; border-radius: 4px; margin: 12px 0;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #4338ca;">Why this matches your profile:</p>
              <ul style="margin: 0; padding-left: 18px; color: #475569; font-size: 12px;">
                ${j.reasons.map(r => `<li style="margin-bottom: 4px;">${r}</li>`).join('')}
              </ul>
            </div>
          `
              : ''
          }

          <div style="margin-top: 14px;">
            <a href="${j.jobUrl}" style="${this.buttonStyle}" target="_blank" rel="noopener noreferrer">
              View Job & Apply on Pilot Mama &rarr;
            </a>
          </div>
        </div>
      `
      )
      .join('');

    const html = `
      <div style="${this.baseStyle}">
        <div style="${this.containerStyle}">
          <div style="${this.headerStyle}">
            <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px;">
              🚀 Pilot Mama
            </h2>
            <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 13px;">New Job Alert Notification</p>
          </div>
          <div style="${this.bodyStyle}">
            <p style="color: #0f172a; font-size: 16px; font-weight: 600; margin-top: 0;">
              Hello ${candidateFirstName},
            </p>
            <p style="color: #475569; font-size: 14px; margin-bottom: 24px;">
              ${
                isSingle
                  ? 'A new job matching your profile and preferences was just discovered:'
                  : `We discovered ${jobs.length} new opportunities that match your verified skills, experience, and target career track:`
              }
            </p>

            ${jobsHtml}

            <p style="color: #94a3b8; font-size: 12px; margin-top: 24px;">
              Pilot Mama analyzes real job descriptions and never fabricates matches. You can apply with one click directly using your Master Resume or an optional Tailored Resume.
            </p>
          </div>
          <div style="${this.footerStyle}">
            <p style="margin: 0;">You are receiving this because job alerts are enabled on your Pilot Mama account.</p>
            <p style="margin: 6px 0 0 0;">
              <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">
                Unsubscribe from job alert emails
              </a>
              &bull; 
              <a href="${jobs[0]?.jobUrl ? new URL(jobs[0].jobUrl).origin : 'https://job-pilot-ai-pearl.vercel.app'}" style="color: #64748b; text-decoration: underline;">
                Manage preferences
              </a>
            </p>
          </div>
        </div>
      </div>
    `;

    return { subject, html, text };
  }
}
