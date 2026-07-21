# API

All responses use `{ success, message, data }`. Auth is an httpOnly cookie.

| Method | Path                                 | Purpose                      |
| ------ | ------------------------------------ | ---------------------------- |
| POST   | `/api/v1/auth/register`              | Create an unverified account and send a code |
| POST   | `/api/v1/auth/verify-email`          | Verify the six-digit code and create a session |
| POST   | `/api/v1/auth/resend-verification`   | Send a replacement verification code |
| POST   | `/api/v1/auth/login`                 | Create a session for a verified account |
| POST   | `/api/v1/auth/logout`                | Remove session cookie        |
| GET    | `/api/v1/auth/me`                    | Current user                 |
| GET    | `/api/v1/conversations`              | Current user's conversations |
| GET    | `/api/v1/conversations/:id/messages` | Conversation messages        |
| POST   | `/api/v1/conversations/:id/messages` | Send a text message          |
