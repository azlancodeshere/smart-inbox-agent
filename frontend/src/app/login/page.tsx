import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in · Auth Starter" };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
