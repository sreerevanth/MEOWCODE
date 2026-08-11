import "./globals.css";
import { AuthProvider } from "./lib/auth";
import { ThemeInitializer } from "./components/ThemeInitializer";

export const metadata = {
  title: "Meow Code",
  description: "Universal AI platform for every provider, model, endpoint, and workspace."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AuthProvider>
          <ThemeInitializer />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
