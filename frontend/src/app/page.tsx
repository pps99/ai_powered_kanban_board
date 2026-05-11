"use client";

import { useAuth } from "@/contexts/auth";
import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginPage } from "@/components/LoginPage";

export default function Home() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <KanbanBoard /> : <LoginPage />;
}
