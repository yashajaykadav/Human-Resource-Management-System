import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { SidebarProvider } from '@/context/SidebarContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { AgentDrawer } from '@/components/agent/AgentDrawer';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { NotificationToastContainer } from '@/components/notifications';

export const metadata: Metadata = {
  title: 'Apryde AI HRMS | Autonomous Role-Based HR Intelligence',
  description: 'Enterprise Human Resource Management System powered by Role-Based AI Agents and Skeuomorphic Tactile UI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            <SidebarProvider>
              <NotificationProvider>
                <AuthGuard>
                  <Navbar />
                  <div className="flex flex-1 overflow-hidden">
                    <Sidebar />
                    <main className="flex-1 overflow-y-auto p-5 lg:p-8">
                      <div className="mx-auto max-w-7xl">
                        {children}
                      </div>
                    </main>
                  </div>
                  <AgentDrawer />
                  <NotificationToastContainer />
                </AuthGuard>
              </NotificationProvider>
            </SidebarProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
