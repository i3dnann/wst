import { useEffect, type CSSProperties } from "react";
import { ChevronDown, LockKeyhole, Menu, Radio } from "lucide-react";
import type { PublicPageKey } from "@mafia/shared";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollProgress } from "@/components/ui/scroll-progress";
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
  ["Players", "/players"],
  ["Tournaments", "/tournaments"],
  ["Matches", "/matches"],
  ["Rankings", "/rankings"],
  ["Events", "/events"],
  ["Live", "/live"],
  ["Rules", "/rules"],
  ["About", "/about"],
] as const;

const primaryNavigation = navigation.slice(0, 8);
const moreNavigation = navigation.slice(8);
const publicPageLabels: Record<PublicPageKey, string> = {
  home: "Home",
  gangs: "Gangs",
  players: "Players",
  tournaments: "Tournaments",
  matches: "Matches",
  rankings: "Rankings",
  events: "Events",
  live: "Live",
  rules: "Rules",
  about: "About",
};
const publicPageKeySet = new Set<PublicPageKey>(
  Object.keys(publicPageLabels) as PublicPageKey[],
);
const publicSiteUrl = (
  import.meta.env.VITE_PUBLIC_SITE_URL ??
  (import.meta.env.PROD ? "https://wstgang.com" : window.location.origin)
).replace(/\/+$/, "");

const legacyBrandColors: Record<string, string> = {
  "#b88a44": "#c51f38",
  "#c89a52": "#c51f38",
  "#d3ad68": "#ef4058",
  "#d7c7a1": "#ef4058",
  "#5b3a20": "#6f0d1c",
};

function currentBrandColor(value: string, fallback: string) {
  return legacyBrandColors[value.toLowerCase()] || value || fallback;
}

function Brand({
  logoUrl,
  name = "WORLD STAR",
}: {
  logoUrl?: string | undefined;
  name?: string;
}) {
  return (
    <Link to="/" className="wst-brand" aria-label="World Star home">
      <img src={logoUrl || "/assets/wst/wst-logo.png"} alt="" />
      <span>
        {name}
        <small>Competitive Gang Registry</small>
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

function DesktopNavigation() {
  return (
    <>
      {primaryNavigation.map(([label, href]) => (
        <NavigationItem key={href} label={label} href={href} />
      ))}
      <details className="nav-more">
        <summary className="nav-link">
          More <ChevronDown aria-hidden="true" />
        </summary>
        <div className="nav-more-menu">
          {moreNavigation.map(([label, href]) => (
            <NavigationItem key={href} label={label} href={href} />
          ))}
        </div>
      </details>
    </>
  );
}

function NavigationItem({ label, href }: { label: string; href: string }) {
  return (
    <span>
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
    </span>
  );
}

function MaintenancePage({
  logoUrl,
  shortName,
}: {
  logoUrl: string | undefined;
  shortName: string;
}) {
  return (
    <main className="maintenance-page" aria-labelledby="maintenance-title">
      <img
        className="maintenance-page__image"
        src="/assets/wst-red/admin-office-red.jpg"
        alt="A suited mafia figure seated in a dark private lounge"
      />
      <div className="maintenance-page__shade" aria-hidden="true" />
      <section className="maintenance-page__content">
        <img src={logoUrl || "/assets/wst/wst-logo.png"} alt="" />
        <p>{shortName}</p>
        <h1 id="maintenance-title">Maintenance in progress</h1>
        <span>
          The registry is being upgraded behind the scenes. Public pages will
          return as soon as the next build is ready.
        </span>
        <Button asChild className="maintenance-page__login">
          <Link to="/admin/login">Administrator login</Link>
        </Button>
      </section>
    </main>
  );
}

function pageKeyFromPath(pathname: string): PublicPageKey | null {
  if (pathname === "/") return "home";
  const segment = pathname.split("/").filter(Boolean)[0];
  return segment && publicPageKeySet.has(segment as PublicPageKey)
    ? (segment as PublicPageKey)
    : null;
}

function ComingSoonPage({
  logoUrl,
  pageName,
  shortName,
}: {
  logoUrl: string | undefined;
  pageName: string;
  shortName: string;
}) {
  return (
    <main className="coming-soon-page" aria-labelledby="coming-soon-title">
      <img
        className="coming-soon-page__image"
        src="/assets/wst-red/city-overlook-red.jpg"
        alt=""
      />
      <div className="coming-soon-page__shade" aria-hidden="true" />
      <div className="coming-soon-page__grid" aria-hidden="true" />
      <section className="coming-soon-page__content">
        <div className="coming-soon-page__brand">
          <img src={logoUrl || "/assets/wst/wst-logo.png"} alt="" />
          <span>{shortName}</span>
        </div>
        <p className="coming-soon-page__eyebrow">
          <LockKeyhole aria-hidden="true" /> Public access paused
        </p>
        <span className="coming-soon-page__section">{pageName}</span>
        <h1 id="coming-soon-title">Coming Soon</h1>
        <div className="coming-soon-page__line" aria-hidden="true">
          <i />
          <strong>COMING SOON</strong>
          <i />
        </div>
        <p className="coming-soon-page__message">
          This section is being prepared by the World Star command center. Check
          back soon for the official release.
        </p>
      </section>
    </main>
  );
}

function PublicAccessLoading() {
  return (
    <main className="public-access-loading" aria-label="Loading page access">
      <span className="public-access-loading__mark" aria-hidden="true" />
    </main>
  );
}

export function PublicLayout() {
  const location = useLocation();
  const website = usePublicWebsiteSettings();
  const settings = website.data;
  const brandStyle = settings
    ? ({
        "--brand-primary": currentBrandColor(
          settings.branding.primaryColor,
          "#c51f38",
        ),
        "--brand-secondary": currentBrandColor(
          settings.branding.secondaryColor,
          "#6f0d1c",
        ),
        "--brand-accent": currentBrandColor(
          settings.branding.accentColor,
          "#ef4058",
        ),
      } as CSSProperties)
    : undefined;
  const logoUrl = settings?.general.logoUrl || undefined;
  const shortName = settings?.general.shortName || "WORLD STAR";
  const lockedPageKey = pageKeyFromPath(location.pathname);
  const lockedPage =
    lockedPageKey && settings?.pageLocks[lockedPageKey] ? lockedPageKey : null;
  useEffect(() => {
    if (!settings) return;
    document.title = settings.general.websiteName;
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon && settings.general.faviconUrl)
      favicon.href = settings.general.faviconUrl;
  }, [settings]);
  useEffect(() => {
    const canonicalUrl = new URL(location.pathname, `${publicSiteUrl}/`).href;
    let canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = canonicalUrl;

    let openGraphUrl = document.querySelector<HTMLMetaElement>(
      'meta[property="og:url"]',
    );
    if (!openGraphUrl) {
      openGraphUrl = document.createElement("meta");
      openGraphUrl.setAttribute("property", "og:url");
      document.head.append(openGraphUrl);
    }
    openGraphUrl.content = canonicalUrl;
  }, [location.pathname]);
  return (
    <div className="site-frame" style={brandStyle}>
      <ScrollProgress className="site-scroll-progress" />
      {settings?.homepage.announcement ? (
        <div className="site-announcement">
          {settings.homepage.announcement}
        </div>
      ) : null}
      <header className="site-header">
        <Brand logoUrl={logoUrl} name={shortName} />
        <nav className="primary-nav" aria-label="Primary navigation">
          <DesktopNavigation />
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

      {website.isPending ? (
        <PublicAccessLoading />
      ) : settings?.general.maintenanceMode ? (
        <MaintenancePage logoUrl={logoUrl} shortName={shortName} />
      ) : lockedPage ? (
        <ComingSoonPage
          logoUrl={logoUrl}
          pageName={publicPageLabels[lockedPage]}
          shortName={shortName}
        />
      ) : (
        <Outlet />
      )}

      <footer className="site-footer">
        <div className="footer-brand">
          <img src={logoUrl || "/assets/wst/wst-logo.png"} alt={shortName} />
          <p>
            {settings?.general.description ||
              "A modern competitive registry for gangs, tournaments, rankings, live streams, events, and verified match records."}
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
        <small className="site-footer__legal">
          <span>
            © {new Date().getFullYear()} {shortName}. All rights reserved.
          </span>
          <span className="site-footer__studio-credit">
            Created with <em>love</em> by{" "}
            <a
              href="https://discord.gg/eZqaNx5P7y"
              target="_blank"
              rel="noopener noreferrer"
            >
              A2 Studio
            </a>
          </span>
        </small>
      </footer>
    </div>
  );
}
