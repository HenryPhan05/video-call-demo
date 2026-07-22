import {
  useCallback,
  FormEvent,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import axios from "axios";

import {
  deleteMessage,
  forgotPassword,
  getConversations,
  getMe,
  getMessages,
  login,
  logout,
  markConversationSeen,
  Message,
  register,
  resetPassword,
  resendVerification,
  searchUsers,
  sendMessage,
  startConversation,
  toggleReaction,
  updateCurrentUser,
  updateMessage,
  uploadAttachment,
  uploadAvatar,
  User,
  verifyEmail,
} from "./api/chat";
import { AttachmentPicker } from "./components/chat/AttachmentPicker";
import { FileDropZone } from "./components/chat/FileDropZone";
import { AttachmentPreview } from "./components/chat/AttachmentPreview";
import { AttachmentMessage } from "./components/chat/AttachmentMessage";
import { VoiceRecorder } from "./components/chat/VoiceRecorder";
import { CallManager } from "./components/chat/CallManager";

const AuthBackground = lazy(() => import("./components/auth/AuthBackground"));

const SOCKET_URL = "http://localhost:4000";
const avatarUrl = (url?: string | null) => (url ? `${SOCKET_URL}${url}` : "");

type NavigateOptions = {
  replace?: boolean;
};

type Navigate = (path: string, options?: NavigateOptions) => void;
type Theme = "light" | "dark";

const themeStorageKey = "chatting.theme";

const initialTheme = (): Theme => {
  const saved = localStorage.getItem(themeStorageKey);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const normalizePath = (path: string) => {
  const normalized = path.replace(/\/+$/, "");
  return normalized || "/";
};

const conversationIdFromPath = (path: string) => {
  const match = normalizePath(path).match(/^\/conversations\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : "";
};

function useAppNavigation() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const handlePopState = () =>
      setPath(normalizePath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback<Navigate>((nextPath, options) => {
    const normalized = normalizePath(nextPath);
    if (normalized === normalizePath(window.location.pathname)) {
      setPath(normalized);
      return;
    }
    window.history[options?.replace ? "replaceState" : "pushState"](
      {
        chatting: true,
      },
      "",
      normalized,
    );
    setPath(normalized);
  }, []);

  return {
    path,
    navigate,
  };
}

export function App() {
  const {
    path,
    navigate,
  } = useAppNavigation();
  const initialSessionResolved = useRef(false);
  const toastTimer = useRef<number | null>(null);
  const [routeReady, setRouteReady] = useState(false);
  const [successToast, setSuccessToast] = useState("");
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const me = useQuery({
    queryKey: ["me"],
    queryFn: getMe,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (me.isLoading || initialSessionResolved.current) return;
    initialSessionResolved.current = true;
    navigate(me.data ? "/conversations" : "/login", {
      replace: true,
    });
    setRouteReady(true);
  }, [me.data, me.isLoading, navigate]);

  useEffect(
    () => () => {
      if (toastTimer.current !== null)
        window.clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const showSuccessToast = useCallback((message: string) => {
    if (toastTimer.current !== null)
      window.clearTimeout(toastTimer.current);
    setSuccessToast(message);
    toastTimer.current = window.setTimeout(() => {
      setSuccessToast("");
      toastTimer.current = null;
    }, 4_000);
  }, []);

  const dismissSuccessToast = () => {
    if (toastTimer.current !== null)
      window.clearTimeout(toastTimer.current);
    toastTimer.current = null;
    setSuccessToast("");
  };

  if (me.isLoading || !routeReady)
    return (
      <main className="auth">
        <Suspense fallback={null}>
          <AuthBackground />
        </Suspense>
        <h1>Chatting</h1>
        <p>Loading...</p>
      </main>
    );
  return (
    <>
      {me.data ? (
        <Chat
          user={me.data.user}
          path={path}
          navigate={navigate}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      ) : (
        <Auth
          path={path}
          navigate={navigate}
          onSuccessNotice={showSuccessToast}
        />
      )}
      {successToast && (
        <SuccessToast
          message={successToast}
          onDismiss={dismissSuccessToast}
        />
      )}
    </>
  );
}

function SuccessToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <aside className="success-toast" role="status" aria-live="polite">
      <span className="success-toast-icon" aria-hidden="true">
        ✓
      </span>
      <span className="success-toast-copy">
        <strong>Success</strong>
        <small>{message}</small>
      </span>
      <button type="button" onClick={onDismiss} aria-label="Close notification">
        ×
      </button>
      <span className="success-toast-timer" aria-hidden="true" />
    </aside>
  );
}

function Auth({
  path,
  navigate,
  onSuccessNotice,
}: {
  path: string;
  navigate: Navigate;
  onSuccessNotice: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const registrationDraftKey = "chatting.registration-draft";
  const pendingEmailKey = "chatting.pending-verification-email";
  const resendDeadlineKey = "chatting.resend-available-at";
  const resetDeadlineKey = "chatting.password-reset-resend-at";
  const [mode, setMode] = useState<"login" | "register">(() =>
    path === "/register" ? "register" : "login",
  );
  const [registrationDraft] = useState<{
    firstName?: string;
    lastName?: string;
    username?: string;
    email?: string;
  }>(() => {
    try {
      return JSON.parse(
        sessionStorage.getItem(registrationDraftKey) ?? "{}",
      );
    } catch {
      sessionStorage.removeItem(registrationDraftKey);
      return {};
    }
  });
  const [firstName, setFirstName] = useState(registrationDraft.firstName ?? "");
  const [lastName, setLastName] = useState(registrationDraft.lastName ?? "");
  const [username, setUsername] = useState(registrationDraft.username ?? "");
  const [email, setEmail] = useState(registrationDraft.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [verificationEmail, setVerificationEmail] = useState<string | null>(
    () => sessionStorage.getItem(pendingEmailKey),
  );
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [resendCooldown, setResendCooldown] = useState(() => {
    const deadline = Number(sessionStorage.getItem(resendDeadlineKey) ?? 0);
    return Math.max(0, Math.ceil((deadline - Date.now()) / 1_000));
  });
  const [resetStep, setResetStep] = useState<"email" | "code">("email");
  const [resetEmail, setResetEmail] = useState(
    registrationDraft.email ?? "",
  );
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [resetCooldown, setResetCooldown] = useState(() => {
    const deadline = Number(sessionStorage.getItem(resetDeadlineKey) ?? 0);
    return Math.max(0, Math.ceil((deadline - Date.now()) / 1_000));
  });
  const passwordRules = {
    length: password.length >= 8 && password.length < 30,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9\s]/.test(password),
  };
  const matchedPasswordCases = [
    passwordRules.uppercase,
    passwordRules.lowercase,
    passwordRules.number,
    passwordRules.special,
  ].filter(Boolean).length;
  const passwordStrength =
    matchedPasswordCases === 4 && passwordRules.length
      ? "strong"
      : matchedPasswordCases === 0
        ? "low"
        : "weak";
  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;
  const newPasswordRules = {
    length: newPassword.length >= 8 && newPassword.length < 30,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9\s]/.test(newPassword),
  };
  const matchedNewPasswordCases = [
    newPasswordRules.uppercase,
    newPasswordRules.lowercase,
    newPasswordRules.number,
    newPasswordRules.special,
  ].filter(Boolean).length;
  const newPasswordStrength =
    matchedNewPasswordCases === 4 && newPasswordRules.length
      ? "strong"
      : matchedNewPasswordCases === 0
        ? "low"
        : "weak";
  const newPasswordsMatch =
    confirmNewPassword.length > 0 && newPassword === confirmNewPassword;

  useEffect(() => {
    sessionStorage.setItem(
      registrationDraftKey,
      JSON.stringify({
        firstName,
        lastName,
        username,
        email,
      }),
    );
  }, [email, firstName, lastName, mode, username]);

  useEffect(() => {
    if (path === "/register") setMode("register");
    if (path === "/login") setMode("login");
    if (path === "/verify-email" && !verificationEmail)
      navigate("/login", {
        replace: true,
      });
  }, [navigate, path, verificationEmail]);

  const clearRegistrationSession = () => {
    sessionStorage.removeItem(registrationDraftKey);
  };

  const rememberVerificationEmail = (value: string) => {
    sessionStorage.setItem(pendingEmailKey, value);
    setVerificationEmail(value);
  };

  const startResendCooldown = () => {
    sessionStorage.setItem(
      resendDeadlineKey,
      String(Date.now() + 60_000),
    );
    setResendCooldown(60);
  };

  const startResetCooldown = () => {
    sessionStorage.setItem(resetDeadlineKey, String(Date.now() + 60_000));
    setResetCooldown(60);
  };

  const clearPendingVerification = () => {
    sessionStorage.removeItem(pendingEmailKey);
    sessionStorage.removeItem(resendDeadlineKey);
    setVerificationEmail(null);
    setResendCooldown(0);
  };

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => {
      const deadline = Number(
        sessionStorage.getItem(resendDeadlineKey) ?? 0,
      );
      const remaining = Math.max(
        0,
        Math.ceil((deadline - Date.now()) / 1_000),
      );
      setResendCooldown(remaining);
      if (remaining === 0) sessionStorage.removeItem(resendDeadlineKey);
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = window.setTimeout(() => {
      const deadline = Number(sessionStorage.getItem(resetDeadlineKey) ?? 0);
      const remaining = Math.max(
        0,
        Math.ceil((deadline - Date.now()) / 1_000),
      );
      setResetCooldown(remaining);
      if (remaining === 0) sessionStorage.removeItem(resetDeadlineKey);
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [resetCooldown]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "login")
        return {
          kind: "login" as const,
          result: await login({
            email,
            password,
          }),
        };
      return {
        kind: "register" as const,
        result: await register({
          firstName,
          lastName: lastName.trim() || undefined,
          username,
          email,
          password,
        }),
      };
    },
    onSuccess: (response) => {
      if (response.kind === "login") {
        clearRegistrationSession();
        onSuccessNotice("Successfully logged in. Welcome back!");
        queryClient.setQueryData(["me"], response.result);
        navigate("/conversations", {
          replace: true,
        });
        return;
      }
      rememberVerificationEmail(response.result.email);
      navigate("/verify-email");
      setVerificationCode("");
      setVerificationMessage("We sent a six-digit code to your email.");
      setError("");
    },
    onError: (cause) => {
      const message = axios.isAxiosError(cause)
        ? cause.response?.data?.message
        : undefined;
      if (
        mode === "login" &&
        axios.isAxiosError(cause) &&
        cause.response?.status === 403
      ) {
        rememberVerificationEmail(email.trim().toLowerCase());
        navigate("/verify-email");
        setVerificationCode("");
        setVerificationMessage("Enter your verification code to continue.");
      }
      setError(
        message ?? "Authentication failed. Check your details and try again.",
      );
    },
  });

  const verificationMutation = useMutation({
    mutationFn: () =>
      verifyEmail({
        email: verificationEmail!,
        code: verificationCode,
      }),
    onSuccess: (response) => {
      clearPendingVerification();
      clearRegistrationSession();
      onSuccessNotice("Registration successful. Welcome to Chatting!");
      queryClient.setQueryData(["me"], response);
      navigate("/conversations", {
        replace: true,
      });
    },
    onError: (cause) => {
      const message = axios.isAxiosError(cause)
        ? cause.response?.data?.message
        : undefined;
      setError(message ?? "The verification code could not be accepted.");
    },
  });

  const resendMutation = useMutation({
    mutationFn: () => resendVerification(verificationEmail!),
    onSuccess: () => {
      setError("");
      setVerificationMessage("A new six-digit code has been sent.");
      startResendCooldown();
    },
    onError: (cause) => {
      const message = axios.isAxiosError(cause)
        ? cause.response?.data?.message
        : undefined;
      setError(message ?? "A new verification code could not be sent.");
      if (axios.isAxiosError(cause) && cause.response?.status === 429)
        startResendCooldown();
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: () => forgotPassword(resetEmail.trim().toLowerCase()),
    onSuccess: () => {
      setError("");
      setResetStep("code");
      setResetMessage(
        "We sent a six-digit password reset code to your email.",
      );
      startResetCooldown();
    },
    onError: (cause) => {
      const message = axios.isAxiosError(cause)
        ? cause.response?.data?.message
        : undefined;
      const backendUnavailable =
        axios.isAxiosError(cause) && !cause.response;
      setError(
        message ??
          (backendUnavailable
            ? "Cannot connect to the backend. Start the server on port 4000 and try again."
            : "The password reset code could not be sent."),
      );
      if (axios.isAxiosError(cause) && cause.response?.status === 429)
        startResetCooldown();
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: () =>
      resetPassword({
        email: resetEmail.trim().toLowerCase(),
        code: resetCode,
        password: newPassword,
      }),
    onSuccess: () => {
      sessionStorage.removeItem(resetDeadlineKey);
      setEmail(resetEmail.trim().toLowerCase());
      setPassword("");
      setResetCode("");
      setNewPassword("");
      setConfirmNewPassword("");
      setResetMessage("");
      setResetCooldown(0);
      setResetStep("email");
      setError("");
      onSuccessNotice("Password reset successfully. Please sign in.");
      setMode("login");
      navigate("/login", {
        replace: true,
      });
    },
    onError: (cause) => {
      const message = axios.isAxiosError(cause)
        ? cause.response?.data?.message
        : undefined;
      const backendUnavailable =
        axios.isAxiosError(cause) && !cause.response;
      setError(
        message ??
          (backendUnavailable
            ? "Cannot connect to the backend. Start the server on port 4000 and try again."
            : "Your password could not be reset."),
      );
    },
  });

  const handleAuthSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (mutation.isPending) return;
    setError("");
    mutation.mutate();
  };

  const handleVerificationSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (verificationMutation.isPending) return;
    setError("");
    verificationMutation.mutate();
  };

  const handleForgotPasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (forgotPasswordMutation.isPending) return;
    setError("");
    forgotPasswordMutation.mutate();
  };

  const handleResetPasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (resetPasswordMutation.isPending) return;
    setError("");
    resetPasswordMutation.mutate();
  };

  if (verificationEmail && path === "/verify-email")
    return (
      <main className="auth">
        <Suspense fallback={null}>
          <AuthBackground />
        </Suspense>
        <h1>Chatting</h1>
        <h2>Verify your email</h2>
        <form onSubmit={handleVerificationSubmit}>
          <p className="verification-help">
            Enter the code sent to <strong>{verificationEmail}</strong>.
          </p>
          <input
            className="verification-code"
            value={verificationCode}
            onChange={(event) =>
              setVerificationCode(event.target.value.replace(/\D/g, ""))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            minLength={6}
            maxLength={6}
            pattern="[0-9]{6}"
            aria-label="Six-digit verification code"
            autoFocus
            required
          />
          {verificationMessage && (
            <p className="verification-message">{verificationMessage}</p>
          )}
          {resendCooldown > 0 && (
            <p className="verification-cooldown" aria-live="polite">
              Cooldown: <strong>{resendCooldown}</strong>{" "}
              {resendCooldown === 1 ? "second" : "seconds"}
            </p>
          )}
          {error && <p className="error">{error}</p>}
          <button
            type="submit"
            disabled={
              verificationCode.length !== 6 || verificationMutation.isPending
            }
          >
            {verificationMutation.isPending
              ? "Verifying..."
              : "Verify and continue"}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={resendMutation.isPending || resendCooldown > 0}
            onClick={() => resendMutation.mutate()}
          >
            {resendMutation.isPending
              ? "Sending..."
              : resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : "Resend code"}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              clearPendingVerification();
              clearRegistrationSession();
              setVerificationCode("");
              setVerificationMessage("");
              setError("");
              setMode("login");
              navigate("/login", {
                replace: true,
              });
            }}
          >
            Back to sign in
          </button>
        </form>
      </main>
    );

  if (path === "/forgot-password")
    return (
      <main className="auth">
        <Suspense fallback={null}>
          <AuthBackground />
        </Suspense>
        <h1>Chatting</h1>
        <h2>{resetStep === "email" ? "Forgot password" : "Reset password"}</h2>
        <form
          onSubmit={
            resetStep === "email"
              ? handleForgotPasswordSubmit
              : handleResetPasswordSubmit
          }
        >
          {resetStep === "email" ? (
            <>
              <p className="verification-help">
                Enter the email connected to your account. We will send you a
                six-digit reset code.
              </p>
              <input
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                type="email"
                placeholder="Email"
                autoComplete="email"
                autoFocus
                required
              />
            </>
          ) : (
            <>
              <p className="verification-help">
                Enter the six-digit code sent to <strong>{resetEmail}</strong>.
              </p>
              <input
                className="verification-code"
                value={resetCode}
                onChange={(event) =>
                  setResetCode(event.target.value.replace(/\D/g, ""))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                minLength={6}
                maxLength={6}
                pattern="[0-9]{6}"
                aria-label="Six-digit password reset code"
                autoFocus
                required
              />
              <div className="password-field">
                <input
                  id="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  type={showNewPassword ? "text" : "password"}
                  placeholder="New password"
                  minLength={8}
                  maxLength={29}
                  autoComplete="new-password"
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowNewPassword((current) => !current)}
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                  aria-controls="new-password"
                  aria-pressed={showNewPassword}
                >
                  <PasswordVisibilityIcon visible={showNewPassword} />
                </button>
              </div>
              <div className={`password-strength ${newPasswordStrength}`}>
                <div className="password-strength-heading">
                  <strong>Password strength</strong>
                  <span>{newPasswordStrength}</span>
                </div>
                <div className="password-strength-bars" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <ul>
                  <li className={newPasswordRules.length ? "passed" : ""}>
                    8–29 characters
                  </li>
                  <li className={newPasswordRules.uppercase ? "passed" : ""}>
                    One uppercase letter
                  </li>
                  <li className={newPasswordRules.lowercase ? "passed" : ""}>
                    One lowercase letter
                  </li>
                  <li className={newPasswordRules.number ? "passed" : ""}>
                    One number
                  </li>
                  <li className={newPasswordRules.special ? "passed" : ""}>
                    One special character
                  </li>
                </ul>
              </div>
              <div className="password-field">
                <input
                  id="confirm-new-password"
                  value={confirmNewPassword}
                  onChange={(event) =>
                    setConfirmNewPassword(event.target.value)
                  }
                  type={showConfirmNewPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  minLength={8}
                  maxLength={29}
                  autoComplete="new-password"
                  aria-invalid={
                    confirmNewPassword.length > 0 && !newPasswordsMatch
                  }
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() =>
                    setShowConfirmNewPassword((current) => !current)
                  }
                  aria-label={
                    showConfirmNewPassword
                      ? "Hide confirmation password"
                      : "Show confirmation password"
                  }
                  aria-controls="confirm-new-password"
                  aria-pressed={showConfirmNewPassword}
                >
                  <PasswordVisibilityIcon visible={showConfirmNewPassword} />
                </button>
              </div>
              {confirmNewPassword.length > 0 && (
                <p
                  className={`password-confirmation ${newPasswordsMatch ? "matched" : "mismatched"}`}
                >
                  {newPasswordsMatch
                    ? "Passwords match."
                    : "Passwords do not match."}
                </p>
              )}
            </>
          )}
          {resetMessage && (
            <p className="verification-message">{resetMessage}</p>
          )}
          {resetStep === "code" && resetCooldown > 0 && (
            <p className="verification-cooldown" aria-live="polite">
              Resend available in <strong>{resetCooldown}</strong>{" "}
              {resetCooldown === 1 ? "second" : "seconds"}
            </p>
          )}
          {error && <p className="error">{error}</p>}
          <button
            type="submit"
            disabled={
              resetStep === "email"
                ? forgotPasswordMutation.isPending || !resetEmail.trim()
                : resetPasswordMutation.isPending ||
                  resetCode.length !== 6 ||
                  newPasswordStrength !== "strong" ||
                  !newPasswordsMatch
            }
          >
            {resetStep === "email"
              ? forgotPasswordMutation.isPending
                ? "Sending code..."
                : "Send reset code"
              : resetPasswordMutation.isPending
                ? "Resetting password..."
                : "Reset password"}
          </button>
          {resetStep === "code" && (
            <>
              <button
                type="button"
                className="ghost"
                disabled={forgotPasswordMutation.isPending || resetCooldown > 0}
                onClick={() => {
                  setError("");
                  forgotPasswordMutation.mutate();
                }}
              >
                {forgotPasswordMutation.isPending
                  ? "Sending..."
                  : resetCooldown > 0
                    ? `Resend code in ${resetCooldown}s`
                    : "Resend code"}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setResetStep("email");
                  setResetCode("");
                  setNewPassword("");
                  setConfirmNewPassword("");
                  setResetMessage("");
                  setError("");
                }}
              >
                Use a different email
              </button>
            </>
          )}
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setEmail(resetEmail);
              setError("");
              setMode("login");
              navigate("/login");
            }}
          >
            Back to sign in
          </button>
        </form>
      </main>
    );

  return (
    <main className="auth">
      <Suspense fallback={null}>
        <AuthBackground />
      </Suspense>
      <h1>Chatting</h1>
      <h2>{mode === "login" ? "Sign in" : "Register"}</h2>
      <form onSubmit={handleAuthSubmit}>
        {mode === "register" && (
          <>
            <input
              name="firstName"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="First name"
              minLength={2}
              maxLength={100}
              autoComplete="given-name"
              required
            />
            <input
              name="lastName"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Last name (optional)"
              minLength={2}
              maxLength={100}
              autoComplete="family-name"
            />
            <input
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              minLength={5}
              maxLength={30}
              pattern="[A-Za-z0-9._]+"
              title="Use letters, numbers, periods, or underscores."
              autoComplete="username"
              required
            />
          </>
        )}
        <input
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          placeholder="Email"
          autoComplete="email"
          required
        />
        <div className="password-field">
          <input
            id="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            minLength={8}
            maxLength={mode === "register" ? 29 : undefined}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
          />
          <button
            className="password-toggle"
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-controls="password"
            aria-pressed={showPassword}
          >
            <PasswordVisibilityIcon visible={showPassword} />
          </button>
        </div>
        {mode === "register" && (
          <>
            <div className={`password-strength ${passwordStrength}`}>
              <div className="password-strength-heading">
                <strong>Password strength</strong>
                <span>{passwordStrength}</span>
              </div>
              <div className="password-strength-bars" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <ul>
                <li className={passwordRules.length ? "passed" : ""}>
                  8–29 characters
                </li>
                <li className={passwordRules.uppercase ? "passed" : ""}>
                  One uppercase letter
                </li>
                <li className={passwordRules.lowercase ? "passed" : ""}>
                  One lowercase letter
                </li>
                <li className={passwordRules.number ? "passed" : ""}>
                  One number
                </li>
                <li className={passwordRules.special ? "passed" : ""}>
                  One special character
                </li>
              </ul>
            </div>
            <div className="password-field">
              <input
                id="confirm-password"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm password"
                minLength={8}
                maxLength={29}
                autoComplete="new-password"
                aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                required
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() =>
                  setShowConfirmPassword((current) => !current)
                }
                aria-label={
                  showConfirmPassword
                    ? "Hide confirmation password"
                    : "Show confirmation password"
                }
                aria-controls="confirm-password"
                aria-pressed={showConfirmPassword}
              >
                <PasswordVisibilityIcon visible={showConfirmPassword} />
              </button>
            </div>
            {confirmPassword.length > 0 && (
              <p
                className={`password-confirmation ${passwordsMatch ? "matched" : "mismatched"}`}
              >
                {passwordsMatch
                  ? "Passwords match."
                  : "Passwords do not match."}
              </p>
            )}
          </>
        )}
        {error && <p className="error">{error}</p>}
        <button
          type="submit"
          disabled={
            mutation.isPending ||
            (mode === "register" &&
              (passwordStrength !== "strong" || !passwordsMatch))
          }
        >
          {mutation.isPending
            ? "Please wait..."
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
        {mode === "login" && (
          <button
            type="button"
            className="ghost auth-forgot"
            onClick={() => {
              setResetEmail(email);
              setResetStep("email");
              setResetMessage("");
              setError("");
              navigate("/forgot-password");
            }}
          >
            Forgot password?
          </button>
        )}
        <button
          type="button"
          className="ghost auth-switch"
          onClick={() => {
            setError("");
            setShowPassword(false);
            setShowConfirmPassword(false);
            const nextMode = mode === "login" ? "register" : "login";
            setMode(nextMode);
            navigate(`/${nextMode}`);
          }}
        >
          {mode === "login" ? (
            <>
              <span>Need an account?</span> <strong>Register</strong>
            </>
          ) : (
            <>
              <span>Already registered?</span> <strong>Login</strong>
            </>
          )}
        </button>
      </form>
    </main>
  );
}

function PasswordVisibilityIcon({
  visible,
}: {
  visible: boolean;
}) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5 20 19" />
      <path d="M9.6 6.4A10.4 10.4 0 0 1 12 6c6 0 9.5 6 9.5 6a16.8 16.8 0 0 1-3 3.6M6.2 8.1A17 17 0 0 0 2.5 12s3.5 6 9.5 6c1.1 0 2.1-.2 3-.5" />
      <path d="M10.2 10.2a2.75 2.75 0 0 0 3.6 3.6" />
    </svg>
  );
}

function ThemeIcon({
  theme,
}: {
  theme: Theme;
}) {
  return theme === "dark" ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.2 15.2A8.4 8.4 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.64 5.64l1.42 1.42M16.94 16.94l1.42 1.42M5.64 18.36l1.42-1.42M16.94 7.06l1.42-1.42" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function Chat({
  user,
  path,
  navigate,
  theme,
  onToggleTheme,
}: {
  user: User;
  path: string;
  navigate: Navigate;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [conversationId, setConversationId] = useState(() =>
    conversationIdFromPath(path),
  );
  const [draft, setDraft] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [sendError, setSendError] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const [page, setPage] = useState<"chat" | "settings">(() =>
    path === "/settings" ? "settings" : "chat",
  );
  const [socketClient, setSocketClient] = useState<Socket | null>(null);

  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: getConversations,
  });
  const messages = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => getMessages(conversationId),
    enabled: Boolean(conversationId),
  });
  const userResults = useQuery({
    queryKey: ["user-search", userQuery],
    queryFn: () => searchUsers(userQuery),
    enabled: userQuery.trim().length >= 2,
  });
  const activeConversation = conversations.data?.find(
    (conversation) => conversation.id === conversationId,
  );

  useEffect(() => {
    if (path === "/settings") {
      setPage("settings");
      return;
    }
    setPage("chat");
    const routeConversationId = conversationIdFromPath(path);
    if (routeConversationId) setConversationId(routeConversationId);
  }, [path]);

  useEffect(() => {
    if (!conversationId && conversations.data?.[0]) {
      setConversationId(conversations.data[0].id);
      navigate(`/conversations/${encodeURIComponent(conversations.data[0].id)}`, {
        replace: true,
      });
    }
  }, [conversations.data, conversationId, navigate]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      withCredentials: true,
    });
    socketRef.current = socket;
    setSocketClient(socket);

    socket.on("message:new", (message: Message) => {
      queryClient.setQueryData<Message[]>(
        ["messages", message.conversationId],
        (current = []) =>
          current.some((item) => item.id === message.id)
            ? current
            : [...current, message],
      );
      void queryClient.invalidateQueries({
        queryKey: ["conversations"],
      });
    });
    socket.on("message:update", (message: Message) => {
      queryClient.setQueryData<Message[]>(
        ["messages", message.conversationId],
        (current = []) =>
          current.map((item) => (item.id === message.id ? message : item)),
      );
    });
    socket.on("message:delete", (message: Message) => {
      queryClient.setQueryData<Message[]>(
        ["messages", message.conversationId],
        (current = []) => current.filter((item) => item.id !== message.id),
      );
      void queryClient.invalidateQueries({
        queryKey: ["conversations"],
      });
    });
    socket.on(
      "message:seen",
      ({
        conversationId: seenConversationId,
      }: {
 conversationId: string
}) => {
        void queryClient.invalidateQueries({
          queryKey: ["messages", seenConversationId],
        });
      },
    );
    socket.on(
      "typing:update",
      ({
        conversationId: typingConversationId,
        userId,
        isTyping,
      }: {
        conversationId: string;
        userId: string;
        isTyping: boolean;
      }) => {
        setTypingUsers((current) => {
          const users = new Set(current[typingConversationId] ?? []);
          isTyping ? users.add(userId) : users.delete(userId);
          return {
            ...current,
            [typingConversationId]: [...users],
          };
        });
      },
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketClient(null);
    };
  }, [queryClient]);

  useEffect(() => {
    const hasUnseen = messages.data?.some(
      (message) =>
        message.senderId !== user.id &&
        message.receipts?.some(
          (receipt) => receipt.userId === user.id && !receipt.seenAt,
        ),
    );
    if (conversationId && hasUnseen) {
      void markConversationSeen(conversationId);
    }
  }, [conversationId, messages.dataUpdatedAt, messages.data, user.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [conversationId, messages.data?.length]);

  const startChat = useMutation({
    mutationFn: startConversation,
    onSuccess: async (conversation) => {
      setUserQuery("");
      await queryClient.invalidateQueries({
        queryKey: ["conversations"],
      });
      setConversationId(conversation.id);
      navigate(`/conversations/${encodeURIComponent(conversation.id)}`);
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      setSendError("");
      if (editing) return updateMessage(editing.id, draft);

      const outgoingFiles = voiceFile ? [voiceFile] : files;
      const attachmentIds = await Promise.all(
        outgoingFiles.map((file, index) =>
          uploadAttachment(
            conversationId,
            file,
            (percent) => {
              setProgress((current) => ({
                ...current,
                [`${file.name}-${index}`]: percent,
              }));
            },
            voiceFile ? voiceDuration : undefined,
          ).then((attachment) => attachment.id),
        ),
      );
      return sendMessage(conversationId, {
        text: voiceFile ? "" : draft,
        attachmentIds,
        replyToId: replyTo?.id,
      });
    },
    onSuccess: (message) => {
      queryClient.setQueryData<Message[]>(
        ["messages", message.conversationId],
        (current = []) => {
          const existing = current.some((item) => item.id === message.id);
          return existing
            ? current.map((item) => (item.id === message.id ? message : item))
            : [...current, message];
        },
      );
      setDraft("");
      setFiles([]);
      setVoiceFile(null);
      setVoiceDuration(0);
      setRecordingVoice(false);
      setProgress({});
      setReplyTo(null);
      setEditing(null);
      socketRef.current?.emit("typing:stop", {
        conversationId,
      });
    },
    onError: (cause) => {
      const message = axios.isAxiosError(cause)
        ? cause.response?.data?.message
        : undefined;
      setSendError(message ?? "The message or attachment could not be sent.");
    },
  });

  const react = useMutation({
    mutationFn: ({
      messageId, emoji,
    }: {
 messageId: string;
 emoji: string
}) =>
      toggleReaction(messageId, emoji),
    onSuccess: (message) => {
      queryClient.setQueryData<Message[]>(
        ["messages", message.conversationId],
        (current = []) =>
          current.map((item) => (item.id === message.id ? message : item)),
      );
    },
  });
  const remove = useMutation({
    mutationFn: deleteMessage,
    onError: () => setSendError("The message could not be deleted."),
  });

  const selectConversation = (id: string) => {
    if (recordingVoice) return;
    if (conversationId)
      socketRef.current?.emit("typing:stop", {
        conversationId,
      });
    setConversationId(id);
    setReplyTo(null);
    setEditing(null);
    setDraft("");
    setFiles([]);
    setVoiceFile(null);
    setVoiceDuration(0);
    setProgress({});
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (!conversationId) return;
    socketRef.current?.emit(value ? "typing:start" : "typing:stop", {
      conversationId,
    });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (value) {
      typingTimer.current = setTimeout(() => {
        socketRef.current?.emit("typing:stop", {
          conversationId,
        });
      }, 1200);
    }
  };

  const beginEdit = (message: Message) => {
    setEditing(message);
    setReplyTo(null);
    setFiles([]);
    setVoiceFile(null);
    setVoiceDuration(0);
    setRecordingVoice(false);
    setDraft(message.text ?? message.body ?? "");
  };

  return (
    <div className="chat">
      <aside>
        <div className="sidebar-top">
          <p className="brand">CHATTING</p>
          <button
            className="theme-toggle"
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            <ThemeIcon theme={theme} />
          </button>
        </div>
        <button
          className="profile profile-button"
          type="button"
          onClick={() => {
            setPage("settings");
            navigate("/settings");
          }}
        >
          <span className="profile-avatar">
            {user.avatarUrl ? (
              <img src={avatarUrl(user.avatarUrl)} alt="" />
            ) : (
              user.name[0]?.toUpperCase()
            )}
          </span>
          <div>
            <strong>{user.name}</strong>
            <small>Online</small>
          </div>
        </button>
        <label>
          Find someone
          <input
            value={userQuery}
            onChange={(event) => setUserQuery(event.target.value)}
            placeholder="Search by name"
          />
        </label>
        {userResults.data
          ?.filter((result) => result.id !== user.id)
          .map((result) => (
            <button
              className="conversation"
              key={result.id}
              onClick={() => startChat.mutate(result.id)}
              disabled={startChat.isPending || recordingVoice}
            >
              <span className="avatar">{result.name[0]?.toUpperCase()}</span>
              <span>
                <strong>{result.name}</strong>
                <small>Start conversation</small>
              </span>
            </button>
          ))}
        <p className="section-label">CONVERSATIONS</p>
        {conversations.data?.map((conversation) => (
          <button
            className={`conversation ${conversation.id === conversationId && page === "chat" ? "active" : ""}`}
            key={conversation.id}
            onClick={() => {
              setPage("chat");
              selectConversation(conversation.id);
              navigate(`/conversations/${encodeURIComponent(conversation.id)}`);
            }}
            disabled={recordingVoice}
          >
            <span className="avatar">
              {conversation.title[0]?.toUpperCase()}
            </span>
            <span>
              <strong>{conversation.title}</strong>
              <small>
                {conversation.lastMessage?.text ??
                  conversation.lastMessage?.body ??
                  "No messages yet"}
              </small>
            </span>
          </button>
        ))}
        <button
          className={`settings-link ${page === "settings" ? "active" : ""}`}
          type="button"
          onClick={() => {
            setPage("settings");
            navigate("/settings");
          }}
        >
          <SettingsIcon />
          <span className="settings-link-label">Settings</span>
        </button>
        <button
          onClick={() => {
            void logout().then(() => {
              navigate("/login", {
                replace: true,
              });
              queryClient.setQueryData(["me"], null);
            });
          }}
        >
          Sign out
        </button>
      </aside>

      {page === "settings" ? (
        <SettingsPage
          user={user}
          onBack={() => {
            setPage("chat");
            navigate(
              conversationId
                ? `/conversations/${encodeURIComponent(conversationId)}`
                : "/conversations",
            );
          }}
        />
      ) : (
        <main className="thread">
          {!conversationId && (
            <div className="empty">
              Search for another registered user to start chatting.
            </div>
          )}
          {activeConversation && (
            <header className="chat-header">
              <span className="avatar large">
                {activeConversation.title[0]?.toUpperCase()}
              </span>
              <div>
                <h2>{activeConversation.title}</h2>
                <p>Active conversation</p>
              </div>
            </header>
          )}

          <div className="messages">
            {messages.data?.map((message) => {
              const mine = message.senderId === user.id;
              const reactionGroups = Object.entries(
                (message.reactions ?? []).reduce<
                  Record<string, NonNullable<Message["reactions"]>>
                >((groups, reaction) => {
                  (groups[reaction.emoji] ??= []).push(reaction);
                  return groups;
                }, {}),
              );
              const seen = message.receipts?.some((receipt) =>
                Boolean(receipt.seenAt),
              );
              return (
                <div
                  className={`message ${mine ? "mine" : "theirs"}`}
                  key={message.id}
                >
                  {message.replyTo && (
                    <div className="reply-quote">
                      <strong>{message.replyTo.sender.name}</strong>
                      <span>{message.replyTo.body ?? "Attachment"}</span>
                    </div>
                  )}
                  {(message.text ?? message.body) && (
                    <p>{message.text ?? message.body}</p>
                  )}
                  {message.attachments?.map((attachment) => (
                    <AttachmentMessage
                      key={attachment.id}
                      attachment={attachment}
                    />
                  ))}
                  {reactionGroups.length > 0 && (
                    <details className="reaction-details">
                      <summary className="reaction-summary">
                        {reactionGroups.map(([emoji, reactions]) => (
                          <span key={emoji}>
                            {emoji} {reactions.length}
                          </span>
                        ))}
                      </summary>
                      <div className="reaction-people">
                        {(message.reactions ?? []).map((reaction) => (
                          <div key={reaction.id}>
                            <span className="mini-avatar">
                              {reaction.user?.name[0]?.toUpperCase() ?? "?"}
                            </span>
                            <strong>{reaction.user?.name ?? "User"}</strong>
                            <span>{reaction.emoji}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                  <div className="message-meta">
                    <time>
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    {message.editedAt && <span>Edited</span>}
                    {mine && <span>{seen ? "Seen" : "Delivered"}</span>}
                  </div>
                  <div className="message-actions">
                    <button type="button" onClick={() => setReplyTo(message)}>
                      Reply
                    </button>
                    {["👍", "❤️", "😂"].map((emoji) => (
                      <button
                        type="button"
                        aria-label={`React ${emoji}`}
                        key={emoji}
                        onClick={() =>
                          react.mutate({
                            messageId: message.id,
                            emoji,
                          })
                        }
                      >
                        {emoji}
                      </button>
                    ))}
                    {mine && (
                      <button type="button" onClick={() => beginEdit(message)}>
                        Edit
                      </button>
                    )}
                    {mine && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Delete this message for everyone?"))
                            remove.mutate(message.id);
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {Boolean(typingUsers[conversationId]?.length) && (
              <div className="typing-indicator">
                <span />
                <span />
                <span /> typing
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <FileDropZone
            disabled={Boolean(editing || recordingVoice || voiceFile)}
            onFiles={(newFiles) =>
              !editing &&
              !recordingVoice &&
              !voiceFile &&
              setFiles((current) => [...current, ...newFiles])
            }
          >
            <form
              className="composer"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                if (
                  (draft.trim() || files.length || voiceFile) &&
                  !recordingVoice &&
                  !send.isPending
                )
                  send.mutate();
              }}
            >
              {(replyTo || editing) && (
                <div className="composer-context">
                  <span>
                    <strong>
                      {editing
                        ? "Editing message"
                        : `Replying to ${replyTo?.sender?.name ?? "message"}`}
                    </strong>
                    {!editing && (replyTo?.text ?? replyTo?.body)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyTo(null);
                      setEditing(null);
                      setDraft("");
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              {!editing &&
                files.map((file, index) => (
                  <div
                    className="selected-attachment"
                    key={`${file.name}-${index}`}
                  >
                    <AttachmentPreview file={file} />
                    {send.isPending && (
                      <progress
                        max="100"
                        value={progress[`${file.name}-${index}`] ?? 0}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setFiles((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              {!editing && voiceFile && (
                <div className="selected-attachment voice-ready">
                  <AttachmentPreview file={voiceFile} />
                  {send.isPending && (
                    <progress
                      max="100"
                      value={progress[`${voiceFile.name}-0`] ?? 0}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setVoiceFile(null);
                      setVoiceDuration(0);
                    }}
                  >
                    Remove recording
                  </button>
                </div>
              )}
              {!editing && (
                <AttachmentPicker
                  disabled={recordingVoice || Boolean(voiceFile)}
                  onFiles={(newFiles) =>
                    setFiles((current) => [...current, ...newFiles])
                  }
                />
              )}
              {!editing && (
                <VoiceRecorder
                  disabled={files.length > 0 || Boolean(voiceFile)}
                  onRecordingChange={(recording) => {
                    setRecordingVoice(recording);
                    if (recording) {
                      setDraft("");
                      socketRef.current?.emit("typing:stop", {
                        conversationId,
                      });
                    }
                  }}
                  onRecorded={(file, duration) => {
                    setVoiceFile(file);
                    setVoiceDuration(duration);
                    setDraft("");
                  }}
                />
              )}
              {sendError && <p className="error composer-error">{sendError}</p>}
              <input
                value={draft}
                disabled={recordingVoice || Boolean(voiceFile)}
                onChange={(event) => onDraftChange(event.target.value)}
                placeholder={
                  editing
                    ? "Edit message"
                    : voiceFile
                      ? "Voice message ready"
                      : recordingVoice
                        ? "Recording voice message..."
                        : "Write a message"
                }
              />
              <button
                disabled={
                  recordingVoice ||
                  send.isPending ||
                  (!draft.trim() && !files.length && !voiceFile)
                }
              >
                {editing ? "Save" : "Send"}
              </button>
            </form>
          </FileDropZone>
        </main>
      )}
      <CallManager
        socket={socketClient}
        conversationId={conversationId}
        conversationTitle={activeConversation?.title}
        user={user}
        enabled={page === "chat" && Boolean(conversationId)}
      />
    </div>
  );
}

function SettingsPage({
  user, onBack,
}: {
 user: User;
 onBack: () => void
}) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [username, setUsername] = useState(user.username);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState(avatarUrl(user.avatarUrl));
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!avatar) {
      setPreview(avatarUrl(user.avatarUrl));
      return;
    }
    const objectUrl = URL.createObjectURL(avatar);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatar, user.avatarUrl]);

  const save = useMutation({
    mutationFn: async () => {
      setError("");
      setSuccess("");
      let updated = user;
      const profileChanged =
        firstName.trim() !== user.firstName ||
        lastName.trim() !== (user.lastName ?? "") ||
        username.trim().toLowerCase() !== user.username;
      if (profileChanged)
        updated = (
          await updateCurrentUser({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            username: username.trim(),
          })
        ).user;
      if (avatar) updated = (await uploadAvatar(avatar, setProgress)).user;
      return updated;
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(["me"], {
        user: updated,
      });
      setAvatar(null);
      setProgress(0);
      setSuccess("Your profile has been updated.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["conversations"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["messages"],
        }),
      ]);
    },
    onError: (cause) => {
      const message = axios.isAxiosError(cause)
        ? cause.response?.data?.message
        : undefined;
      setError(message ?? "Your profile could not be updated.");
      void queryClient.invalidateQueries({
        queryKey: ["me"],
      });
    },
  });

  return (
    <main className="settings-page">
      <header className="settings-header">
        <button type="button" onClick={onBack} aria-label="Back to messages">
          <BackIcon />
        </button>
        <div>
          <h2>Settings</h2>
          <p>Manage your public chat profile</p>
        </div>
      </header>
      <section className="settings-card">
        <div className="settings-avatar">
          <span>
            {preview ? (
              <img src={preview} alt="Avatar preview" />
            ) : (
              firstName[0]?.toUpperCase()
            )}
          </span>
          <div>
            <h3>Profile photo</h3>
            <p>JPG, PNG or WebP. Maximum 5 MB.</p>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!save.isPending) save.mutate();
          }}
        >
          <label className="settings-field">
            <span>Change avatar</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setError("");
                if (file && file.size > 5 * 1024 * 1024) {
                  setError("Avatar must be 5 MB or smaller.");
                  event.target.value = "";
                  return;
                }
                setAvatar(file);
              }}
            />
          </label>
          {avatar && (
            <button
              className="remove-avatar-selection"
              type="button"
              onClick={() => {
                setAvatar(null);
                setProgress(0);
              }}
            >
              Remove selected photo
            </button>
          )}
          {save.isPending && avatar && (
            <progress className="avatar-progress" max="100" value={progress} />
          )}
          <label className="settings-field">
            <span>First name</span>
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              minLength={2}
              maxLength={100}
              required
            />
          </label>
          <label className="settings-field">
            <span>Last name (optional)</span>
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              minLength={2}
              maxLength={100}
            />
          </label>
          <label className="settings-field">
            <span>Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              minLength={5}
              maxLength={30}
              pattern="[A-Za-z0-9._]+"
              title="Use letters, numbers, periods, or underscores."
              required
            />
            <small>Your username is unique and visible to other users.</small>
          </label>
          <label className="settings-field">
            <span>Email</span>
            <input value={user.email} disabled />
            <small>Email cannot be changed from this page.</small>
          </label>
          {error && <p className="error">{error}</p>}
          {success && <p className="settings-success">{success}</p>}
          <button
            className="save-profile"
            type="submit"
            disabled={
              save.isPending ||
              (!avatar &&
                firstName.trim() === user.firstName &&
                lastName.trim() === (user.lastName ?? "") &&
                username.trim().toLowerCase() === user.username) ||
              firstName.trim().length < 2 ||
              username.trim().length < 5
            }
          >
            {save.isPending ? "Saving..." : "Save changes"}
          </button>
        </form>
      </section>
    </main>
  );
}
