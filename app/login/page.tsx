import type { Metadata } from "next";
import { AuthScreen } from "@/components/auth/auth-screen";

export const metadata: Metadata = { title: "Log in" };

export default function Page() {
  return <AuthScreen mode="signin" />;
}
