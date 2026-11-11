# Afghan Appointment Support

Build a privacy-first MVP web application named "Afghan Free Appointment" for a free, volunteer-run service that helps Afghan families submit requests for identity-verification appointments.

IMPORTANT SCOPE AND SAFETY:
- This first version is ONLY an intake and human-review system. Do NOT automate, scrape, poll, submit forms to, or otherwise interact with the Afghan government appointment website.
- Do not implement CAPTCHA bypass, anti-bot evasion, proxy rotation, or bulk submission.
- Do not request or store real passport numbers, tazkira numbers, scans, or other highly sensitive identity documents in this prototype. Use synthetic demo records only and clearly label them as test data.
- No payments, donations, fees, ads, or commercial features.
- Do not expose applicant data publicly. Avoid putting personal data in URLs, analytics, console logs, or error messages.

PRODUCT:
- A welcoming public landing page explaining that the service is free, volunteer-run, and that submitting a request does not guarantee an appointment.
- Language switch for Dari/Persian and English. Persian/Dari layout must be RTL; English LTR. Default to Persian/Dari.
- Public request form for ONE family member at a time, with a clear prompt that each family member needs a separate request. For this MVP collect only minimum placeholder/test fields: applicant full name, contact phone, city, number of family members needing separate forms, and a short optional note. Add clear consent and privacy notice. Do not collect document numbers or uploads.
- On submit, create a request in Pending Review state and show a reference number. Public users must never be able to approve requests or access other people's records.
- Protected admin dashboard with status counts and a searchable/filterable request queue. Show only necessary information in list rows; open a detail view for review.
- Admin actions: approve, reject, request clarification, mark as completed, and add internal notes. Maintain an audit trail of who changed what and when. Statuses: Pending Review, Needs Clarification, Approved, In Progress, Completed, Rejected.
- Role-based access control: applicant, admin. No public admin signup. Do not hardcode credentials. Provide a clear setup path for configuring the two volunteer administrators securely, without exposing secrets in source code.
- The approval policy (one admin approval vs. two-person approval) must remain configurable/unset until the project owner chooses; do not silently assume a final policy.
- Queue order should default to oldest submission first, with a setting to change the rule later.
- Include a simple admin settings page with placeholders for future notification channels (Telegram/email), but do not send messages yet.
- Include an on-demand automation placeholder that is OFF by default and has no worker, scheduled job, polling, or government-site integration in this MVP.
- Add privacy-by-design: data minimization, least-privilege access, input validation, safe error handling, retention/deletion policy placeholder, and clear warning not to enter real identity information until production security review is complete.

DESIGN:
- Clean, calm, accessible, mobile-responsive design. Use a dignified, neutral visual identity; no government seals, flags, or claims of official affiliation.
- Make it clear this is an independent volunteer initiative and not an official government service.
- Use realistic synthetic demo data only.
- Ensure the app can be previewed and the main public form and admin dashboard flows are demonstrable.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2a9cf54f-8397-4921-97ce-ebea1afa6012).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
