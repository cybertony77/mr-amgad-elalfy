import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Font Awesome */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css" />

        {/* Theme & App Settings */}
        <meta name="theme-color" content="#00101f" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Math Academy" />
        <meta name="apple-touch-fullscreen" content="yes" />
        <meta property="og:title" content="Math Academy, Mr. Amged El-Alfy" />
        <meta property="og:description" content="Math Academy, Mr. Amged El-Alfy's students" />
        <meta property="og:image" content="/icons/apple-icon-180.png" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />

        {/* Camera Permission Policy */}
        <meta httpEquiv="Permissions-Policy" content="camera=(self)" />

        {/* Icons for iOS */}
        <link rel="apple-touch-icon" href="/icons/apple-icon-180.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
