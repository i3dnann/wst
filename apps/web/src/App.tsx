import { lazy, Suspense, type KeyboardEvent, type WheelEvent } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { PublicLayout } from "./components/layout/PublicLayout";
import { PageSkeleton } from "./components/data/StatusState";
import { RealtimeBridge } from "./components/realtime/RealtimeBridge";

const HomePage = lazy(() => import("./pages/HomePage"));
const GangsPage = lazy(() => import("./pages/GangsPage"));
const GangDetailPage = lazy(() => import("./pages/GangDetailPage"));
const DirectoryPage = lazy(() => import("./pages/DirectoryPage"));
const TournamentsPage = lazy(() => import("./pages/TournamentsPage"));
const TournamentDetailPage = lazy(() => import("./pages/TournamentDetailPage"));
const RankingsPage = lazy(() => import("./pages/RankingsPage"));
const AdminPage = lazy(() => import("./pages/AdminCommandCenterPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const InformationPage = lazy(() => import("./pages/InformationPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const EventsPage = lazy(() => import("./pages/EventsPage"));
const LivePage = lazy(() => import("./pages/LivePage"));

const blockedIntegerKeys = new Set(["e", "E", "+", "-", "."]);

function guardIntegerInput(event: KeyboardEvent<HTMLDivElement>) {
  const input = event.target;
  if (
    input instanceof HTMLInputElement &&
    input.type === "number" &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    blockedIntegerKeys.has(event.key)
  ) {
    event.preventDefault();
  }
}

function preventNumberWheelChange(event: WheelEvent<HTMLDivElement>) {
  const input = event.target;
  if (
    input instanceof HTMLInputElement &&
    input.type === "number" &&
    document.activeElement === input
  ) {
    input.blur();
  }
}

export function App() {
  const location = useLocation();
  const admin = location.pathname.startsWith("/admin");

  return (
    <>
      <RealtimeBridge />
      <AnimatePresence mode="wait">
        <motion.div
          key={admin ? "admin" : "public"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onKeyDownCapture={guardIntegerInput}
          onWheelCapture={preventNumberWheelChange}
        >
          <Suspense fallback={<PageSkeleton />}>
            <Routes location={location}>
              <Route element={<PublicLayout />}>
                <Route index element={<HomePage />} />
                <Route path="gangs" element={<GangsPage />} />
                <Route path="gangs/:slug" element={<GangDetailPage />} />
                <Route
                  path="players"
                  element={<DirectoryPage type="players" />}
                />
                <Route
                  path="players/:slug"
                  element={<DirectoryPage type="player-profile" />}
                />
                <Route path="tournaments" element={<TournamentsPage />} />
                <Route
                  path="tournaments/:slug"
                  element={<TournamentDetailPage />}
                />
                <Route path="rankings" element={<RankingsPage />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="live" element={<LivePage />} />
                <Route
                  path="matches"
                  element={<DirectoryPage type="matches" />}
                />
                <Route
                  path="matches/:id"
                  element={<DirectoryPage type="match-detail" />}
                />
                <Route
                  path="login"
                  element={<Navigate to="/admin/login" replace />}
                />
                <Route
                  path="rules"
                  element={<InformationPage kind="rules" />}
                />
                <Route
                  path="about"
                  element={<InformationPage kind="about" />}
                />
                <Route
                  path="dashboard/*"
                  element={<InformationPage kind="dashboard" />}
                />
                <Route path="404" element={<NotFoundPage />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Route>
              <Route path="admin/login" element={<LoginPage />} />
              <Route path="admin/*" element={<AdminPage />} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
