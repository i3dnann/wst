import { Menu, Shield, UserRound } from "lucide-react";
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
  ["Gangs", "/gangs"],
  ["Players", "/players"],
  ["Tournaments", "/tournaments"],
  ["Rankings", "/rankings"],
  ["Matches", "/matches"],
  ["Rules", "/rules"],
] as const;

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
        <Link to="/" className="wordmark" aria-label="Mafia home">
          MAFIA
        </Link>
        <Navigation />
        <Button asChild variant="outline" className="login-button">
          <Link to="/login">
            <UserRound data-icon="inline-start" />
            Login
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
              <SheetTitle>MAFIA</SheetTitle>
              <SheetDescription>
                Navigate the criminal network registry.
              </SheetDescription>
            </SheetHeader>
            <Navigation mobile />
            <Button asChild variant="outline">
              <Link to="/login">
                <UserRound data-icon="inline-start" />
                Login
              </Link>
            </Button>
          </SheetContent>
        </Sheet>
      </header>
      <Outlet />
      <footer className="site-footer">
        <div>
          <Link to="/" className="wordmark wordmark--footer">
            MAFIA
          </Link>
          <p>The official FiveM criminal network registry.</p>
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
          <Shield aria-hidden="true" />
          <span>All public records are API-sourced.</span>
        </div>
      </footer>
    </div>
  );
}
