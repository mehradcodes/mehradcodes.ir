# امنیت سایت — آماده برای هاست جدید

این پوشه یعنی وقتی هاست گرفتی، دیگه لازم نیست دوباره سراغ امنیت بری — فایل آماده‌ست، فقط بذارش روی هاست.

## کدوم فایل برای کدوم هاست؟

| هاست | چی کار کن |
|---|---|
| **Apache / cPanel / DirectAdmin** (معمول‌ترین هاست‌های ایرانی) | هیچی — فایل `.htaccess` که توی روت سایته با بقیه‌ی فایل‌ها آپلود می‌شه و خودش هدرها رو ست می‌کنه. |
| **Nginx** | محتوای `nginx-headers.conf` رو توی بلاک `server { }` سایت بذار (اگه یه `location` خودش `add_header` داره، این خط‌ها رو اونجا هم تکرار کن). |
| **Cloudflare Pages / Netlify** | فایل `_headers` توی همین پوشه‌ست و خودش خونده می‌شه. |

## یه قانون مهم: فقط یه منبع هدر

هدرها الان از **یه جا** میان: قانون «Security headers» توی Cloudflare (Transform Rule). وقتی سایت رفت روی هاست جدید، **یا** اون قانون Cloudflare رو نگه دار (اگه سایت هنوز پشت Cloudflareـه) **یا** فایل هاست رو فعال کن — هر دو با هم نه. دو تا هدر تکراری خراب نمی‌کنه ولی شلوغه.

اگه هاست جدید پشت Cloudflare نیست: قانون Cloudflare رو پاک/خاموش کن و `.htaccess` (یا معادلش) رو بذار — همین.

## مقدارها

هر ۶ هدر با همون مقداریه که الان لایوه (نمره‌ی **A+** توی securityheaders.com):

- Strict-Transport-Security: `max-age=31536000; includeSubDomains`
- Content-Security-Policy: `default-src 'self'; script-src 'self' https://telegram.org; style-src 'self'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://mehradcodes-bot.haj0-0mehrad.workers.dev; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests`
- X-Frame-Options: `SAMEORIGIN`
- X-Content-Type-Options: `nosniff`
- Referrer-Policy: `strict-origin-when-cross-origin`
- Permissions-Policy: `camera=(), microphone=(), geolocation=()`

## چرا A+ شد؟

CSP دیگه `unsafe-inline` نداره — چون همه‌ی اسکریپت‌ها و استایل‌ها از فایل خارجی میان (`assets/js/main.js`، `shop/app.js`، `shop/style.css`). اگه بعداً خواستی کد به صفحه اضافه کنی، **داخل تگ `<script>` یا `style="..."` ننویس** — بذارش توی همون فایل‌های خارجی، وگرنه مرورگر بلاکش می‌کنه.
