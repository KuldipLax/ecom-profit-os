import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export async function AppShell({
  children,
  title,
  businessName,
  role,
}: {
  children: React.ReactNode;
  title: string;
  businessName?: string;
  role: string;
}) {
  return (
    <div className="app">
      <Sidebar role={role} />
      <div className="main">
        <Topbar businessName={businessName} />
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
