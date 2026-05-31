import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  return (
    <PublicShell>
      <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-12">
        <form className="w-full rounded-md border border-bc-line bg-bc-panel p-6">
          <p className="text-sm font-semibold uppercase text-bc-pink">Join Bouncecore</p>
          <h1 className="mt-2 text-3xl font-black">Register</h1>
          <label className="mt-6 block text-sm font-semibold" htmlFor="name">
            Display name
          </label>
          <input className="mt-2 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2" id="name" />
          <label className="mt-4 block text-sm font-semibold" htmlFor="email">
            Email
          </label>
          <input className="mt-2 w-full rounded-md border border-bc-line bg-bc-ink px-3 py-2" id="email" type="email" />
          <Button className="mt-6 w-full" type="button" variant="pink">
            Register placeholder
          </Button>
        </form>
      </main>
    </PublicShell>
  );
}
