import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

type LogoutButtonProps = {
  className?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
};

export function LogoutButton({ className, label = "Logout", size = "sm" }: LogoutButtonProps) {
  return (
    <form action="/api/auth/logout" className={className} method="post">
      <Button className="w-full" size={size} type="submit" variant="ghost">
        <LogOut className="h-4 w-4" aria-hidden="true" />
        {label}
      </Button>
    </form>
  );
}
