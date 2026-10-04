import type { Metadata } from "next";
import { Inter, Playfair_Display, Unbounded, Space_Grotesk, JetBrains_Mono, Oswald, Heebo, Rubik, Secular_One, Frank_Ruhl_Libre, Suez_One } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

const playfair = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  variable: "--font-playfair",
});

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
  weight: ["400", "500", "700", "800", "900"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "700", "800"],
});

const oswald = Oswald({
  subsets: ["latin", "cyrillic"],
  variable: "--font-oswald",
  weight: ["400", "500", "600", "700"],
});

const heebo = Heebo({
  subsets: ["latin", "hebrew"],
  variable: "--font-heebo",
  weight: ["400", "500", "700", "800", "900"],
});

const rubik = Rubik({ subsets: ["latin", "hebrew"], variable: "--font-rubik", weight: ["400", "500", "700", "800", "900"] });
const secularOne = Secular_One({ subsets: ["latin", "hebrew"], variable: "--font-secular", weight: ["400"] });
const frankRuhl = Frank_Ruhl_Libre({ subsets: ["latin", "hebrew"], variable: "--font-frank", weight: ["400", "500", "700", "900"] });
const suezOne = Suez_One({ subsets: ["latin", "hebrew"], variable: "--font-suez", weight: ["400"] });

export const metadata: Metadata = {
  title: "Threads Carousel Generator",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he">
      <body className={`${inter.variable} ${playfair.variable} ${unbounded.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${oswald.variable} ${heebo.variable} ${rubik.variable} ${secularOne.variable} ${frankRuhl.variable} ${suezOne.variable} font-sans antialiased bg-neutral-900 text-white`}>
        {children}
      </body>
    </html>
  );
}
