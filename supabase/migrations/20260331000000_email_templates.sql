-- ============================================================
-- VivaThrift Email Templates
-- ============================================================
-- Paste these HTML templates into Supabase Dashboard:
-- Authentication → Email Templates
--
-- SMTP Settings (Supabase Dashboard → Project Settings → Auth → SMTP):
--   Host: smtp.resend.com
--   Port: 465
--   Username: resend
--   Password: (Resend API Key)
--   Sender email: admin@vivathrift.store
--   Sender name: VivaThrift
--
-- URL Configuration (Authentication → URL Configuration):
--   Site URL: https://vivathrift.store
--   Redirect URLs:
--     - https://vivathrift.store/auth/confirm
--     - http://localhost:3004/auth/confirm
-- ============================================================

-- ============================================================
-- 1. RESET PASSWORD TEMPLATE
-- ============================================================
-- Subject: Reset Password - VivaThrift
-- Paste the HTML below into: Authentication → Email Templates → Reset Password
-- ============================================================

/*
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Reset Password - VivaThrift</title>
</head>
<body style="margin:0;padding:0;background-color:#e0f2fe;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#e0f2fe;padding:32px 0;">
    <tr>
      <td align="center">
        <!-- Container -->
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #bae6fd;">
          <!-- Header with sky blue gradient -->
          <tr>
            <td align="center" style="background:#0ea5e9;background:linear-gradient(135deg,#0ea5e9,#38bdf8);padding:32px 24px;">
              <img src="https://raw.githubusercontent.com/MIqbalBY/VivaThrift/main/public/img/Logo%20VivaThrift.png" alt="VivaThrift" width="64" height="64" style="display:block;width:64px;height:64px;margin:0 auto 14px auto;border-radius:14px;background-color:#ffffff;padding:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15);" />
              <span style="font-size:24px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;text-shadow:0 1px 2px rgba(0,0,0,0.15);">VivaThrift</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 28px;">
              <h1 style="margin:0 0 8px 0;font-size:20px;color:#0c4a6e;">Reset Password</h1>
              <p style="margin:0 0 20px 0;font-size:14px;color:#334155;line-height:1.6;">
                Hai! Kami menerima permintaan untuk mereset password akun VivaThrift kamu.
              </p>
              <p style="margin:0 0 24px 0;font-size:14px;color:#334155;line-height:1.6;">
                Klik tombol di bawah untuk membuat password baru:
              </p>
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;background-color:#0ea5e9;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:8px;box-shadow:0 2px 6px rgba(14,165,233,0.35);">
                      Reset Password Saya
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td style="border-top:1px solid #e2e8f0;"></td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">
                Jika kamu tidak meminta reset password, abaikan email ini. Link akan kadaluarsa dalam 24 jam.
              </p>
            </td>
          </tr>
          <!-- Footer with matching blue theme -->
          <tr>
            <td align="center" style="background-color:#f0f9ff;padding:20px 28px;border-top:1px solid #bae6fd;">
              <p style="margin:0;font-size:12px;color:#0c4a6e;font-weight:600;">
                &copy; 2026 VivaThrift &mdash; Marketplace Preloved ITS
              </p>
              <p style="margin:6px 0 0 0;font-size:11px;color:#0369a1;">
                <a href="https://vivathrift.store" style="color:#0ea5e9;text-decoration:none;font-weight:600;">vivathrift.store</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
*/

-- ============================================================
-- 2. CONFIRM SIGNUP TEMPLATE
-- ============================================================
-- Subject: Konfirmasi Email - VivaThrift
-- Paste the HTML below into: Authentication → Email Templates → Confirm Signup
-- ============================================================

/*
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Konfirmasi Email - VivaThrift</title>
</head>
<body style="margin:0;padding:0;background-color:#e0f2fe;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#e0f2fe;padding:32px 0;">
    <tr>
      <td align="center">
        <!-- Container -->
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #bae6fd;">
          <!-- Header with sky blue gradient -->
          <tr>
            <td align="center" style="background:#0ea5e9;background:linear-gradient(135deg,#0ea5e9,#38bdf8);padding:32px 24px;">
              <img src="https://raw.githubusercontent.com/MIqbalBY/VivaThrift/main/public/img/Logo%20VivaThrift.png" alt="VivaThrift" width="64" height="64" style="display:block;width:64px;height:64px;margin:0 auto 14px auto;border-radius:14px;background-color:#ffffff;padding:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15);" />
              <span style="font-size:24px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;text-shadow:0 1px 2px rgba(0,0,0,0.15);">VivaThrift</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 28px;">
              <h1 style="margin:0 0 8px 0;font-size:20px;color:#0c4a6e;">Konfirmasi Email Kamu</h1>
              <p style="margin:0 0 20px 0;font-size:14px;color:#334155;line-height:1.6;">
                Selamat datang di VivaThrift! Terima kasih sudah mendaftar.
              </p>
              <p style="margin:0 0 24px 0;font-size:14px;color:#334155;line-height:1.6;">
                Klik tombol di bawah untuk mengkonfirmasi alamat email kamu:
              </p>
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="display:inline-block;background-color:#0ea5e9;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;padding:14px 36px;border-radius:8px;box-shadow:0 2px 6px rgba(14,165,233,0.35);">
                      Konfirmasi Email
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td style="border-top:1px solid #e2e8f0;"></td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">
                Jika kamu tidak membuat akun di VivaThrift, abaikan email ini.
              </p>
            </td>
          </tr>
          <!-- Footer with matching blue theme -->
          <tr>
            <td align="center" style="background-color:#f0f9ff;padding:20px 28px;border-top:1px solid #bae6fd;">
              <p style="margin:0;font-size:12px;color:#0c4a6e;font-weight:600;">
                &copy; 2026 VivaThrift &mdash; Marketplace Preloved ITS
              </p>
              <p style="margin:6px 0 0 0;font-size:11px;color:#0369a1;">
                <a href="https://vivathrift.store" style="color:#0ea5e9;text-decoration:none;font-weight:600;">vivathrift.store</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
*/
