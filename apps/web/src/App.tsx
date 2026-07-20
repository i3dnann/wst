import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { PublicLayout } from "./components/layout/PublicLayout";
import { PageSkeleton } from "./components/data/StatusState";

const HomePage = lazy(() => import("./pages/HomePage"));
const GangsPage = lazy(() => import("./pages/GangsPage"));
const GangDetailPage = lazy(() => import("./pages/GangDetailPage"));
const DirectoryPage = lazy(() => import("./pages/DirectoryPage"));
const TournamentsPage = lazy(() => import("./pages/TournamentsPage"));
const TournamentDetailPage = lazy(() => import("./pages/TournamentDetailPage"));
const RankingsPage = lazy(() => import("./pages/RankingsPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const InformationPage = lazy(() => import("./pages/InformationPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

export function App() {
  const location = useLocation();
  const admin = location.pathname.startsWith("/admin");

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={admin ? "admin" : "public"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
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
              <Route
                path="matches"
                element={<DirectoryPage type="matches" />}
              />
              <Route
                path="matches/:id"
                element={<DirectoryPage type="match-detail" />}
              />
              <Route path="login" element={<LoginPage />} />
              <Route path="rules" element={<InformationPage kind="rules" />} />
              <Route path="about" element={<InformationPage kind="about" />} />
              <Route
                path="dashboard/*"
                element={<InformationPage kind="dashboard" />}
              />
              <Route path="404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Route>
            <Route path="admin/*" element={<AdminPage />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}
