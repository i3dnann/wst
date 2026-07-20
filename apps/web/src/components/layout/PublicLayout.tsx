import { LockKeyhole, Menu, ShieldCheck } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  ["Home", "/"],
  ["Gangs", "/gangs"],
  ["Players", "/players"],
  ["Tournaments", "/tournaments"],
  ["Rankings", "/rankings"],
  ["Matches", "/matches"],
  ["Rules", "/rules"],
] as const;

function Brand() {
  return (
    <Link to="/" className="wst-brand" aria-label="World Star home">
      <img src="/assets/wst/wst-round.png" alt="" />
      <span>
        WORLD STAR<small>Official registry</small>
      </span>
    </Link>
  );
}

function Navigation({ mobile = false }: { mobile?: boolean }) {
  return (
    <nav
      aria-label={mobile ? "Mobile navigation" : "Primary navigation"}
      className={cn("primary-nav", mobile && "primary-nav--mobile")}
    >
      {navItems.map(([label, href]) => (
        <NavLink
          key={href}
          to={href}
          end={href === "/"}
          className={({ isActive }) =>
            cn("nav-link", isActive && "nav-link--active")
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function PublicLayout() {
  return (
    <div className="site-frame">
      <header className="site-header">
        <Brand />
        <Navigation />
        <Button asChild variant="outline" className="login-button">
          <Link to="/admin/login">
            <LockKeyhole />
            Admin Login
          </Link>
        </Button>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="menu-button"
              aria-label="Open navigation"
            >
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="mobile-sheet">
            <SheetHeader>
              <SheetTitle>WORLD STAR</SheetTitle>
              <SheetDescription>
                Browse the official World Star records.
              </SheetDescription>
            </SheetHeader>
            <Navigation mobile />
            <Button asChild variant="outline">
              <Link to="/admin/login">
                <LockKeyhole />
                Admin Login
              </Link>
            </Button>
          </SheetContent>
        </Sheet>
      </header>
      <Outlet />
      <footer className="site-footer">
        <div className="footer-brand">
          <Brand />
          <p>The official World Star community registry.</p>
        </div>
        <nav aria-label="Footer navigation">
          {navItems.map(([label, href]) => (
            <Link key={href} to={href}>
              {label}
            </Link>
          ))}
          <Link to="/about">About</Link>
        </nav>
        <div className="footer-security">
          <ShieldCheck aria-hidden="true" />
          <span>Published records are maintained by administrators.</span>
        </div>
      </footer>
    </div>
  );
}
