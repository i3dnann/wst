import { useEffect, type CSSProperties } from "react";
import { LockKeyhole, Menu, Radio } from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { usePublicWebsiteSettings } from "@/lib/website-settings";

const navigation = [
  ["Home", "/"],
  ["Gangs", "/gangs"],
  ["Tournaments", "/tournaments"],
  ["Events", "/events"],
  ["Rankings", "/rankings"],
  ["Matches", "/matches"],
  ["Live", "/live"],
] as const;

function Brand({
  logoUrl,
  name = "WORLD STAR",
}: {
  logoUrl?: string | undefined;
  name?: string;
}) {
  return (
    <Link to="/" className="wst-brand" aria-label="World Star home">
      <img src={logoUrl || "/assets/wst-gold/wst-gold.png"} alt="" />
      <span>
        {name}
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
  const website = usePublicWebsiteSettings();
  const settings = website.data;
  const brandStyle = settings
    ? ({
        "--primary": settings.branding.primaryColor,
        "--secondary": settings.branding.secondaryColor,
        "--cyan-strong": settings.branding.accentColor,
      } as CSSProperties)
    : undefined;
  const logoUrl = settings?.general.logoUrl || undefined;
  const shortName = settings?.general.shortName || "WORLD STAR";
  useEffect(() => {
    if (!settings) return;
    document.title = settings.general.websiteName;
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon && settings.general.faviconUrl)
      favicon.href = settings.general.faviconUrl;
  }, [settings]);
  return (
    <div className="site-frame" style={brandStyle}>
      {settings?.homepage.announcement ? (
        <div className="site-announcement">
          {settings.homepage.announcement}
        </div>
      ) : null}
      {settings?.general.maintenanceMode ? (
        <div className="site-announcement site-announcement--warning">
          Maintenance mode is enabled. Public information may be temporarily
          unavailable.
        </div>
      ) : null}
      <header className="site-header">
        <Brand logoUrl={logoUrl} name={shortName} />
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
            <Brand logoUrl={logoUrl} name={shortName} />
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
          <img
            src={logoUrl || "/assets/wst-gold/wst-gold.png"}
            alt={shortName}
          />
          <p>
            {settings?.general.description ||
              "A competitive community built on loyalty, power, respect, and records controlled by its administrator."}
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
        {settings && Object.values(settings.social).some(Boolean) ? (
          <div>
            <strong>Social</strong>
            {Object.entries(settings.social)
              .filter((entry): entry is [string, string] => Boolean(entry[1]))
              .map(([name, url]) => (
                <a key={name} href={url} target="_blank" rel="noreferrer">
                  {name.charAt(0).toUpperCase() + name.slice(1)}
                </a>
              ))}
          </div>
        ) : null}
        <small>
          © {new Date().getFullYear()} {shortName}. All rights reserved.
        </small>
      </footer>
    </div>
  );
}
