import { LockKeyhole, Menu, Radio } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const navigation = [
  ["Home", "/"],
  ["Gangs", "/gangs"],
  ["Tournaments", "/tournaments"],
  ["Events", "/events"],
  ["Rankings", "/rankings"],
  ["Matches", "/matches"],
  ["Live", "/live"],
] as const;

function Brand() {
  return (
    <Link to="/" className="wst-brand" aria-label="World Star home">
      <img src="/assets/wst-gold/wst-gold.png" alt="" />
      <span>
        WORLD STAR
        <small>Loyalty · Power · Respect</small>
      </span>
    </Link>
  );
}

function NavigationLinks({ mobile = false }: { mobile?: boolean }) {
  const location = useLocation();
  return navigation.map(([label, href]) => {
    const active =
      href === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(href);
    if (mobile) {
      return (
        <SheetClose asChild key={href}>
          <Link
            to={href}
            className={`nav-link${active ? " nav-link--active" : ""}`}
          >
            {label === "Live" ? <Radio aria-hidden="true" /> : null}
            {label}
          </Link>
        </SheetClose>
      );
    }
    const link = (
      <NavLink
        to={href}
        className={({ isActive }) =>
          `nav-link${isActive ? " nav-link--active" : ""}`
        }
        end={href === "/"}
      >
        {label === "Live" ? <Radio aria-hidden="true" /> : null}
        {label}
      </NavLink>
    );
    return <span key={href}>{link}</span>;
  });
}

export function PublicLayout() {
  return (
    <div className="site-frame">
      <header className="site-header">
        <Brand />
        <nav className="primary-nav" aria-label="Primary navigation">
          <NavigationLinks />
        </nav>
        <Button asChild variant="outline" className="login-button">
          <Link to="/admin/login">
            <LockKeyhole /> Admin Login
          </Link>
        </Button>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="mobile-menu-trigger"
              aria-label="Open navigation"
            >
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent className="mobile-navigation">
            <Brand />
            <nav aria-label="Mobile navigation">
              <NavigationLinks mobile />
            </nav>
            <SheetClose asChild>
              <Button asChild className="mobile-admin-link">
                <Link to="/admin/login">
                  <LockKeyhole /> Admin Login
                </Link>
              </Button>
            </SheetClose>
          </SheetContent>
        </Sheet>
      </header>

      <Outlet />

      <footer className="site-footer">
        <div className="footer-brand">
          <img src="/assets/wst-gold/wst-gold.png" alt="World Star" />
          <p>
            A competitive community built on loyalty, power, respect, and
            records controlled by its administrator.
          </p>
        </div>
        <div>
          <strong>Navigate</strong>
          <Link to="/gangs">Gangs</Link>
          <Link to="/tournaments">Tournaments</Link>
          <Link to="/events">Events</Link>
          <Link to="/live">Live</Link>
        </div>
        <div>
          <strong>Information</strong>
          <Link to="/rules">Rules</Link>
          <Link to="/about">About</Link>
          <Link to="/admin/login">Administrator</Link>
        </div>
        <small>
          © {new Date().getFullYear()} WORLD STAR. All rights reserved.
        </small>
      </footer>
    </div>
  );
}
