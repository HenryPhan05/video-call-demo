# API

All responses use `{ success, message, data }`. Auth is an httpOnly cookie.

| Method | Path                                 | Purpose                      |
| ------ | ------------------------------------ | ---------------------------- |
| POST   | `/api/v1/auth/register`              | Create account and session   |
| POST   | `/api/v1/auth/login`                 | Create session               |
| POST   | `/api/v1/auth/logout`                | Remove session cookie        |
| GET    | `/api/v1/auth/me`                    | Current user                 |
| GET    | `/api/v1/conversations`              | Current user's conversations |
| GET    | `/api/v1/conversations/:id/messages` | Conversation messages        |
| POST   | `/api/v1/conversations/:id/messages` | Send a text message          |
