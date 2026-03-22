import Image from "next/image";
import Link from "next/link";
import { Button } from "./components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-border bg-background">
              <Image
                src="/logo.webp"
                alt="OpsDesk logo"
                fill
                className="object-cover"
                sizes="48px"
                priority
              />
            </div>
            <span className="text-2xl font-semibold text-foreground">
              OpsDesk
            </span>
          </div>
          <div className="space-y-2">
            <CardTitle>Auth system imported</CardTitle>
            <CardDescription>
              Sign in, register, or continue with the auth flows copied from the
              export bundle.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="flex-1">
            <Link href="/login">Go to Login</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/register">Create Account</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
